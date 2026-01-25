import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, categories, productInventory, productVariants, settings, productCategories } from '@/lib/schema';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { normalizeProductImages, normalizeProductTags } from '@/utils/jsonUtils';

// Get stock management setting
async function getStockManagementSetting() {
  try {
    const setting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'stock_management_enabled'))
      .limit(1);

    return setting.length > 0 ? setting[0].value === 'true' : false;
  } catch (error) {
    console.error('Error fetching stock management setting:', error);
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get('categoryId');
    const categorySlug = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Check if stock management is enabled
    const stockManagementEnabled = await getStockManagementSetting();

    let whereConditions = [eq(products.isActive, true)];

    // Filter by category if provided
    if (categoryId) {
      whereConditions.push(
        sql`EXISTS (
          SELECT 1
          FROM ${productCategories}
          WHERE ${productCategories.productId} = ${products.id}
            AND ${productCategories.categoryId} = ${categoryId}
        )`
      );
    } else if (categorySlug && categorySlug !== 'all') {
      // First get the category ID from slug
      const category = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(
          eq(categories.slug, categorySlug.toLowerCase()),
          eq(categories.isActive, true)
        ))
        .limit(1);

      if (category.length > 0) {
        whereConditions.push(
          sql`EXISTS (
            SELECT 1
            FROM ${productCategories}
            WHERE ${productCategories.productId} = ${products.id}
              AND ${productCategories.categoryId} = ${category[0].id}
          )`
        );
      }
    }

    // Fetch products with category information and inventory
    const productsWithDetails = await db
      .select({
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          shortDescription: products.shortDescription,
          price: products.price,
          comparePrice: products.comparePrice,
          images: products.images,
          videoUrl: products.videoUrl,
          thc: products.thc,
          cbd: products.cbd,
          isActive: products.isActive,
          isFeatured: products.isFeatured,
          tags: products.tags,
          productType: products.productType,
          outOfStock: products.outOfStock,
          stockManagementType: products.stockManagementType,
          pricePerUnit: products.pricePerUnit,
          baseWeightUnit: products.baseWeightUnit,
          createdAt: products.createdAt,
        },
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        },
        // Get inventory info to determine stock status
        inventory: {
          totalQuantity: sql<number>`COALESCE(SUM(${productInventory.quantity}), 0)`,
        },
        // Get variant stock information for variable products
        variantStock: {
          totalVariants: sql<number>`COUNT(CASE WHEN ${products.productType} = 'variable' AND ${productVariants.isActive} = 1 THEN 1 END)`,
          outOfStockVariants: sql<number>`COUNT(CASE WHEN ${products.productType} = 'variable' AND ${productVariants.isActive} = 1 AND ${productVariants.outOfStock} = 1 THEN 1 END)`,
        },
        // Get price range for variable products
        priceRange: {
          minPrice: sql<number>`MIN(CASE WHEN ${products.productType} = 'variable' AND ${productVariants.isActive} = 1 THEN ${productVariants.price} END)`,
          maxPrice: sql<number>`MAX(CASE WHEN ${products.productType} = 'variable' AND ${productVariants.isActive} = 1 THEN ${productVariants.price} END)`,
        }
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(productInventory, eq(productInventory.productId, products.id))
      .leftJoin(productVariants, and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isActive, true)
      ))
      .where(and(...whereConditions))
      .groupBy(products.id, categories.id)
      .orderBy(
        desc(sql<number>`CASE WHEN ${products.outOfStock} = 0 THEN 1 ELSE 0 END`), // In stock first (only check out_of_stock column)
        desc(products.isFeatured),
        desc(products.createdAt)
      )
      .limit(limit);

    // Fetch inventory data for all products if stock management is enabled
    type InventoryData = {
      availableQuantity?: number;
      availableWeight?: number;
    };
    let inventoryMap: Map<string, InventoryData> = new Map();

    if (stockManagementEnabled) {
      const productIds = productsWithDetails.map(p => p.product.id);
      const inventories = await db
        .select({
          productId: productInventory.productId,
          availableQuantity: productInventory.availableQuantity,
          availableWeight: productInventory.availableWeight
        })
        .from(productInventory)
        .where(
          and(
            sql`${productInventory.productId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`, `)})`,
            isNull(productInventory.variantId)
          )
        );

      inventories.forEach(inv => {
        if (inv.productId) {
          inventoryMap.set(inv.productId, {
            availableQuantity: inv.availableQuantity || 0,
            availableWeight: inv.availableWeight ? parseFloat(inv.availableWeight.toString()) : 0
          });
        }
      });
    }

    // Transform the data to match the frontend Product interface
    const transformedProducts = productsWithDetails.map(item => {
      // Parse JSON fields safely
      let images: string[] = [];
      let tags: string[] = [];

      // Parse images using the normalization utility (handles sortOrder)
      images = normalizeProductImages(item.product.images);

      // Debug logging for images
      console.log(`Product ${item.product.name} images:`, {
        raw: item.product.images,
        parsed: images,
        firstImage: images[0]
      });

      // Parse tags using the normalization utility
      tags = normalizeProductTags(item.product.tags);

      // Calculate stock status based on product type
      let inStock = false;
      if (item.product.productType === 'variable') {
        // For variable products: in stock if has variants and not ALL variants are out of stock
        const hasVariants = (item.variantStock?.totalVariants || 0) > 0;
        const allVariantsOutOfStock = hasVariants &&
          item.variantStock?.totalVariants === item.variantStock?.outOfStockVariants;
        inStock = hasVariants && !allVariantsOutOfStock;

        console.log(`=== PRODUCT STOCK DEBUG (${item.product.name}) ===`);
        console.log('Product Type:', item.product.productType);
        console.log('Total Variants:', item.variantStock?.totalVariants);
        console.log('Out of Stock Variants:', item.variantStock?.outOfStockVariants);
        console.log('Has Variants:', hasVariants);
        console.log('All Variants Out of Stock:', allVariantsOutOfStock);
        console.log('Final inStock:', inStock);
        console.log('Price Range - Min:', item.priceRange?.minPrice, 'Max:', item.priceRange?.maxPrice);
      } else {
        // For simple products: only check outOfStock column, ignore inventory
        const isMarkedOutOfStock = item.product.outOfStock === true;
        inStock = !isMarkedOutOfStock;

        console.log(`=== SIMPLE PRODUCT STOCK DEBUG (${item.product.name}) ===`);
        console.log('Product Type:', item.product.productType);
        console.log('OutOfStock Column:', item.product.outOfStock);
        console.log('Is Marked Out of Stock:', isMarkedOutOfStock);
        console.log('Final inStock:', inStock);
      }

      // Calculate display price for variable products
      let displayPrice = parseFloat(item.product.price?.toString() || '0');
      let minPrice = null;
      let maxPrice = null;
      let isVariableProduct = item.product.productType === 'variable';

      if (isVariableProduct && item.priceRange?.minPrice && item.priceRange?.maxPrice) {
        minPrice = parseFloat(item.priceRange.minPrice.toString());
        maxPrice = parseFloat(item.priceRange.maxPrice.toString());

        // For variable products, use the minimum price as the main display price
        displayPrice = minPrice;

        console.log('Price Range Calculation:');
        console.log('- Min Price:', minPrice);
        console.log('- Max Price:', maxPrice);
        console.log('- Display Price:', displayPrice);
      }

      // Get available inventory for simple products
      const inventoryData = !isVariableProduct && stockManagementEnabled
        ? inventoryMap.get(item.product.id)
        : undefined;

      const stockMgmtType = item.product.stockManagementType || 'quantity';
      const isWeightBased = stockMgmtType === 'weight';

      return {
        id: item.product.id,
        name: item.product.name,
        category: item.category?.name || '',
        categorySlug: item.category?.slug || '',
        price: displayPrice,
        comparePrice: item.product.comparePrice ? parseFloat(item.product.comparePrice.toString()) : null,
        // Add price range information for variable products
        minPrice: minPrice,
        maxPrice: maxPrice,
        isVariableProduct: isVariableProduct,
        image: images[0] || null, // First image or null for placeholder
        images: images,
        videoUrl: item.product.videoUrl || null,

        description: item.product.shortDescription || item.product.description || '',
        thc: parseFloat(item.product.thc?.toString() || '0'),
        cbd: parseFloat(item.product.cbd?.toString() || '0'),
        strain: tags.find(tag => ['indica', 'sativa', 'hybrid'].includes(tag.toLowerCase())) || 'hybrid',
        inStock: inStock,
        isFeatured: item.product.isFeatured || false,
        tags: tags,
        createdAt: item.product.createdAt,
        // Add inventory information for simple products
        availableQuantity: !isVariableProduct ? inventoryData?.availableQuantity : undefined,
        availableWeight: !isVariableProduct ? inventoryData?.availableWeight : undefined,
        stockManagementType: !isVariableProduct ? stockMgmtType : undefined,
        pricePerUnit: item.product.pricePerUnit ? parseFloat(item.product.pricePerUnit.toString()) : undefined,
        baseWeightUnit: item.product.baseWeightUnit || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedProducts,
      count: transformedProducts.length
    });

  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}