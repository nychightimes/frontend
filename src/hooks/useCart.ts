'use client'

import { useCart as useCartContext } from '@/contexts/CartContext';
import { Product } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useCart() {
  const cart = useCartContext();
  const { toast } = useToast();

  const addToCartWithToast = async (
    product: Product,
    quantity: number = 1,
    weightInGrams?: number,
    note?: string
  ): Promise<boolean> => {
    // Check inventory before adding to cart
    try {
      const isWeightBased = product.stockManagementType === 'weight';
      const requestedWeightPerUnit = isWeightBased ? (weightInGrams ?? quantity) : undefined;
      const requestedWeightTotal = isWeightBased ? (requestedWeightPerUnit || 0) * quantity : undefined;

      const response = await fetch('/api/inventory/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          variantId: product.variantId || null,
          requestedQuantity: !isWeightBased ? quantity : undefined,
          requestedWeight: isWeightBased ? requestedWeightTotal : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to check inventory",
          variant: "destructive",
          duration: 3000,
        });
        return false;
      }

      if (!result.available) {
        const message = isWeightBased
          ? result.message || `Only ${result.availableWeight}g available`
          : result.message || `Only ${result.availableQuantity} units available`;

        toast({
          title: "Insufficient stock",
          description: message,
          variant: "destructive",
          duration: 3000,
        });
        return false;
      }

      // Get current quantity/weight in cart (sum across all lines for this product/variant)
      const matchingLines = cart.state.items.filter(item =>
        item.product.id === product.id &&
        (item.product.variantId ?? null) === (product.variantId ?? null)
      );

      const currentQuantityInCart = matchingLines.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const currentWeightInCart = matchingLines.reduce((sum, item) => {
        const perUnit = typeof item.numericValue === 'number' ? item.numericValue : 0;
        const units = item.quantity || 0;
        return sum + (perUnit * units);
      }, 0);

      if (isWeightBased) {
        // For weight-based products, compare total grams in cart + grams being added
        const requestedWeight = requestedWeightTotal || 0;
        const totalRequestedWeight = currentWeightInCart + requestedWeight;

        if (result.stockManagementEnabled && totalRequestedWeight > result.availableWeight) {
          const canAdd = result.availableWeight - currentWeightInCart;
          if (canAdd > 0) {
            toast({
              title: "Limited stock",
              description: `Only ${canAdd.toFixed(0)}g more can be added (${result.availableWeight.toFixed(0)}g total available, ${currentWeightInCart.toFixed(0)}g already in cart)`,
              variant: "destructive",
              duration: 4000,
            });
          } else {
            toast({
              title: "Already at maximum",
              description: `You already have the maximum available weight (${currentWeightInCart.toFixed(0)}g) in your cart`,
              variant: "destructive",
              duration: 3000,
            });
          }
          return false;
        }
      } else {
        // For quantity-based products
        const totalRequestedQuantity = currentQuantityInCart + quantity;

        if (result.stockManagementEnabled && totalRequestedQuantity > result.availableQuantity) {
          const canAdd = result.availableQuantity - currentQuantityInCart;
          if (canAdd > 0) {
            toast({
              title: "Limited stock",
              description: `Only ${canAdd} more units can be added (${result.availableQuantity} total available, ${currentQuantityInCart} already in cart)`,
              variant: "destructive",
              duration: 4000,
            });
          } else {
            toast({
              title: "Already at maximum",
              description: `You already have the maximum available quantity (${currentQuantityInCart}) in your cart`,
              variant: "destructive",
              duration: 3000,
            });
          }
          return false;
        }
      }

      // Add to cart
      // For weight-based: quantity=1 (unit count), numericValue=weight in grams
      // For quantity-based: quantity=count, numericValue=undefined
      if (isWeightBased) {
        cart.addToCart(product, quantity, weightInGrams, note);
        console.log(`Added to cart: quantity=${quantity}, numericValue=${weightInGrams}`);
      } else {
        cart.addToCart(product, quantity, undefined, note);
      }

      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart`,
        duration: 2000,
      });

      return true;
    } catch (error) {
      console.error('Error checking inventory:', error);
      toast({
        title: "Error",
        description: "Failed to add item to cart. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
      return false;
    }
  };

  const removeFromCartWithToast = (lineId: string, productName?: string) => {
    cart.removeFromCart(lineId);

    toast({
      title: "Removed from cart",
      description: productName ? `${productName} has been removed from your cart` : "Item removed from cart",
      duration: 2000,
    });
  };

  const updateQuantityWithToast = (lineId: string, quantity: number, productName?: string) => {
    const oldQuantity = cart.state.items.find(item => item.id === lineId)?.quantity || 0;
    cart.updateQuantity(lineId, quantity);

    if (quantity === 0) {
      toast({
        title: "Removed from cart",
        description: productName ? `${productName} has been removed from your cart` : "Item removed from cart",
        duration: 2000,
      });
    } else if (quantity > oldQuantity) {
      toast({
        title: "Quantity updated",
        description: `Increased quantity to ${quantity}`,
        duration: 1500,
      });
    } else if (quantity < oldQuantity) {
      toast({
        title: "Quantity updated",
        description: `Decreased quantity to ${quantity}`,
        duration: 1500,
      });
    }
  };

  const clearCartWithToast = () => {
    const itemCount = cart.state.itemCount;
    cart.clearCart();

    toast({
      title: "Cart cleared",
      description: `Removed ${itemCount} item${itemCount !== 1 ? 's' : ''} from your cart`,
      duration: 2000,
    });
  };

  const isInCart = (productId: string): boolean => {
    return cart.state.items.some(item => item.product.id === productId);
  };

  const getItemQuantity = (productId: string): number => {
    return cart.state.items
      .filter(item => item.product.id === productId)
      .reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const getItemSubtotal = (productId: string): number => {
    return cart.state.items
      .filter(item => item.product.id === productId)
      .reduce((sum, item) => sum + ((item.product.price || 0) * (item.quantity || 0)), 0);
  };

  const getCartSummary = () => {
    const subtotal = cart.state.total;
    const deliveryFee = subtotal > 0 ? 5.99 : 0;
    const tax = subtotal * 0.08;
    const total = subtotal + deliveryFee + tax;

    return {
      subtotal,
      deliveryFee,
      tax,
      total,
      itemCount: cart.state.itemCount,
    };
  };

  return {
    // Original cart context methods
    ...cart,
    // Enhanced methods with toast notifications
    addToCartWithToast,
    removeFromCartWithToast,
    updateQuantityWithToast,
    clearCartWithToast,
    // Utility methods
    isInCart,
    getItemQuantity,
    getItemSubtotal,
    getCartSummary,
  };
}