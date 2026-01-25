'use client'

import { useState } from 'react';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);


  // Determine if weight-based or quantity-based
  const isWeightBased = product.stockManagementType === 'weight';

  // Get max quantity/weight based on available stock
  const maxQuantity = isWeightBased
    ? (product.availableWeight !== undefined && product.availableWeight > 0
      ? product.availableWeight
      : 999)
    : (product.availableQuantity !== undefined && product.availableQuantity > 0
      ? product.availableQuantity
      : 999);

  // Check if out of stock
  const isOutOfStock = isWeightBased
    ? (product.availableWeight !== undefined && product.availableWeight === 0)
    : (product.availableQuantity !== undefined && product.availableQuantity === 0);

  const getStrainColor = (strain: string) => {
    switch (strain) {
      case 'indica': return 'bg-purple-100 text-purple-800';
      case 'sativa': return 'bg-orange-100 text-orange-800';
      case 'hybrid': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-card transition-all duration-300 hover:scale-[1.02] bg-gradient-card">
      <Link href={`/product/${product.id}`} className="block">
        <div className="aspect-square relative overflow-hidden">
          {product.image && !imageError ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              onError={() => {
                setImageError(true);
              }}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <Package className="w-16 h-16 text-muted-foreground/50" />
              {imageError && (
                <span className="text-xs text-muted-foreground absolute bottom-2">Image failed</span>
              )}
            </div>
          )}
          {!product.inStock && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Badge variant="destructive">Out of Stock</Badge>
            </div>
          )}
          {product.category && product.category !== 'Uncategorized' && (
            <Badge
              className="absolute top-2 right-2 bg-blue-100 text-blue-800"
            >
              {product.category}
            </Badge>
          )}
        </div>
      </Link>

      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold text-lg text-foreground">{product.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {product.description.replace(/<[^>]*>/g, '')}
            </p>
          </div>

          <div className="flex justify-between items-center text-sm hidden">
            <div className="flex gap-2">
              <Badge variant="outline">THC: {product.thc}%</Badge>
              <Badge variant="outline">CBD: {product.cbd}%</Badge>
            </div>
          </div>

          <div className="">
            <div>
              <div className="text-2xl font-bold text-primary">
                {product.isVariableProduct && product.minPrice && product.maxPrice ? (
                  product.minPrice === product.maxPrice ? (
                    `$${product.minPrice.toFixed(2)}`
                  ) : (
                    `$${product.minPrice.toFixed(2)} - $${product.maxPrice.toFixed(2)}`
                  )
                ) : (
                  `$${product.price.toFixed(2)}`
                )}
              </div>
              {product.isVariableProduct && product.minPrice && product.maxPrice && product.minPrice !== product.maxPrice && (
                <div className="text-xs text-muted-foreground">Price varies by option</div>
              )}
            </div>

            {product.inStock && (
              <div className="flex flex-col gap-2 w-full ">
                {/* Show available stock if defined */}
                {(product.availableQuantity !== undefined || product.availableWeight !== undefined) && (
                  <div className="text-xs text-center hidden">
                    {!isOutOfStock ? (
                      <span className="text-muted-foreground">
                        {isWeightBased
                          ? `${product.availableWeight?.toFixed(0)}g available`
                          : `${product.availableQuantity} available`
                        }
                      </span>
                    ) : (
                      <span className="text-destructive font-medium">Out of stock</span>
                    )}
                  </div>
                )}


                <div className="flex items-center gap-2 mt-2">
                  {/* View More button for all products */}
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="gap-1 w-full"
                    disabled={isOutOfStock}
                  >
                    <Link href={`/product/${product.id}`}>
                      View More
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}