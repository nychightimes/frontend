'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { CheckoutFormWithData } from '@/components/checkout/CheckoutFormWithData';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { useWeightLabel } from '@/contexts/WeightLabelContext';
import { processCheckout } from './actions';

interface LoyaltySettings {
  enabled: boolean;
  earningRate: number;
  earningBasis: string;
  redemptionValue: number;
  expiryMonths: number;
  minimumOrder: number;
  maxRedemptionPercent: number;
  redemptionMinimum: number;
}

interface CustomerPoints {
  availablePoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
}

export interface CheckoutData {
  paymentMethod: 'cod';
  orderType: 'delivery' | 'pickup' | 'shipping';
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    latitude?: number;
    longitude?: number;
    instructions?: string;
  };
  pickupLocationId?: string;
  orderNotes: string;
  pointsToRedeem?: number;
  pointsDiscountAmount?: number;
  useAllPoints?: boolean;
  couponCode?: string;
  couponDiscountAmount?: number;
}

interface OrderSettings {
  minimumOrderValue: number;
  deliveryFee: number;
  shippingFee: number;
}

interface ShippingStatus {
  enabled: boolean;
  message: string;
  timestamp: string;
}

interface DeliveryStatus {
  enabled: boolean;
  message: string;
  timestamp: string;
}

interface CheckoutClientPageProps {
  loyaltySettings: LoyaltySettings;
  customerPoints: CustomerPoints;
  orderSettings: OrderSettings;
  shippingStatus: ShippingStatus;
  deliveryStatus: DeliveryStatus;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
}

export function CheckoutClientPage({ loyaltySettings, customerPoints, orderSettings, shippingStatus, deliveryStatus, user }: CheckoutClientPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { weightLabel } = useWeightLabel();
  const { state, clearCartWithToast } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [stockValidationErrors, setStockValidationErrors] = useState<string[]>([]);
  const [isValidatingStock, setIsValidatingStock] = useState(true);

  // Validate stock whenever cart items change
  useEffect(() => {
    const validateStock = async () => {
      if (!state.items || state.items.length === 0) {
        setIsValidatingStock(false);
        setStockValidationErrors([]);
        return;
      }

      setIsValidatingStock(true);
      const errors: string[] = [];

      for (const item of state.items) {
        const productName = item.product?.name || 'Unknown Product';
        const quantity = item.quantity || 0;
        const numericValue = item.numericValue;
        const isWeightBased = item.product?.stockManagementType === 'weight';

        // For weight-based products:
        // - quantity = number of units (e.g., 2 means 2 units)
        // - numericValue = weight per unit in grams (e.g., 250g)
        // - totalRequestedWeight = quantity × numericValue (e.g., 2 × 250g = 500g)
        const totalRequestedWeight = isWeightBased && numericValue ? (quantity * numericValue) : 0;

        console.log(`Validating ${productName}:`, {
          quantity,
          numericValue,
          isWeightBased,
          totalRequestedWeight
        });

        try {
          // Check inventory for each item
          const response = await fetch('/api/inventory/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: item.product.id,
              variantId: item.product.variantId || null,
              requestedQuantity: !isWeightBased ? quantity : undefined,
              requestedWeight: isWeightBased ? totalRequestedWeight : undefined,
            }),
          });

          const result = await response.json();

          console.log(`Validation result for ${productName}:`, result);

          if (!response.ok || !result.available) {
            if (isWeightBased) {
              const availableWeight = result.availableWeight || 0;
              if (quantity > 1) {
                errors.push(`${productName}: Insufficient stock. You have ${quantity} units × ${numericValue}${weightLabel} = ${totalRequestedWeight}${weightLabel} in cart but only ${availableWeight}${weightLabel} available.`);
              } else {
                errors.push(`${productName}: Insufficient stock. You have ${totalRequestedWeight}${weightLabel} in cart but only ${availableWeight}${weightLabel} available.`);
              }
            } else {
              const availableQuantity = result.availableQuantity || 0;
              errors.push(`${productName}: Insufficient stock. You have ${quantity} in cart but only ${availableQuantity} available.`);
            }
          }
        } catch (error) {
          console.error(`Error validating stock for ${productName}:`, error);
          errors.push(`${productName}: Unable to verify stock availability.`);
        }
      }

      setStockValidationErrors(errors);
      setIsValidatingStock(false);

      // Show errors if any
      if (errors.length > 0) {
        toast({
          title: "Stock Validation Failed",
          description: `${errors.length} item(s) have insufficient stock. Please update your cart.`,
          variant: "destructive",
          duration: 5000,
        });
      }
    };

    validateStock();
  }, [state.items, toast]);

  // Show cart items on checkout page load (for debugging)
  useEffect(() => {
    if (state.items && state.items.length > 0) {
      // Log cart items for debugging
      state.items.forEach((item, index) => {
        const productName = item.product?.name || 'Unknown';
        const quantity = item.quantity || 0;
        const numericValue = item.numericValue;
        console.log(`Cart item ${index + 1}: ${productName}, quantity: ${quantity}, numericValue: ${numericValue || 'NOT SET'}`);
      });
    }
  }, []); // Only run once on mount

  // Calculate total with tax
  const subtotal = state.total;
  const tax = subtotal * 0.00;
  const total = subtotal + tax;

  const handleCheckoutSubmit = async (data: CheckoutData) => {
    // Block checkout if there are stock validation errors
    if (stockValidationErrors.length > 0) {
      toast({
        title: "Cannot Complete Checkout",
        description: "Some items in your cart have insufficient stock. Please update your cart and try again.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    // Block checkout if still validating
    if (isValidatingStock) {
      toast({
        title: "Please Wait",
        description: "Validating stock availability...",
        variant: "default",
        duration: 3000,
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Show what we're sending to server
      // Log order submission for debugging
      state.items.forEach((item, index) => {
        const productName = item.product?.name || 'Unknown';
        const quantity = item.quantity || 0;
        const numericValue = item.numericValue;
        console.log(`Submitting order item ${index + 1}: ${productName}, qty=${quantity}, numericValue=${numericValue || 'NOT SET'}`);
      });
      
      // Calculate fees based on order type
      const deliveryFee = data.orderType === 'delivery' ? orderSettings.deliveryFee : 0;
      const shippingFee = data.orderType === 'shipping' ? orderSettings.shippingFee : 0;
      const totalWithFees = total + deliveryFee + shippingFee;
      const finalTotal = Math.max(
        0,
        totalWithFees - (data.couponDiscountAmount || 0) - (data.pointsDiscountAmount || 0)
      );
      
      // Create FormData for server action
      const formData = new FormData();
      formData.append('items', JSON.stringify(state.items));
      formData.append('total', finalTotal.toString());
      formData.append('subtotal', subtotal.toString());
      formData.append('deliveryFee', deliveryFee.toString());
      formData.append('shippingFee', shippingFee.toString());
      formData.append('paymentMethod', data.paymentMethod);
      formData.append('orderType', data.orderType);
      console.log('🚀 Submitting order type to server:', data.orderType);
      console.log('🚀 FormData orderType value:', formData.get('orderType'));
      formData.append('customerInfo', JSON.stringify(data.customerInfo));
      if (data.deliveryAddress) {
        formData.append('deliveryAddress', JSON.stringify(data.deliveryAddress));
      }
      if (data.pickupLocationId) {
        formData.append('pickupLocationId', data.pickupLocationId);
      }
      formData.append('orderNotes', data.orderNotes);
      formData.append('pointsToRedeem', (data.pointsToRedeem || 0).toString());
      formData.append('pointsDiscountAmount', (data.pointsDiscountAmount || 0).toString());
      formData.append('couponCode', (data.couponCode || '').toString());

      console.log('📝 Submitting checkout with data:', {
        items: state.items.length,
        total,
        pointsToRedeem: data.pointsToRedeem,
        pointsDiscount: data.pointsDiscountAmount
      });

      // Process checkout via server action
      const result = await processCheckout(formData);
      
      if (result.success) {
        // Save order data to localStorage for the thank you page
        const orderData = {
          orderId: result.orderNumber,
          total: result.total,
          originalTotal: total,
          pointsRedeemed: data.pointsToRedeem || 0,
          pointsDiscount: data.pointsDiscountAmount || 0,
          couponCode: data.couponCode || null,
          couponDiscount: data.couponDiscountAmount || 0,
          pointsEarned: result.pointsEarned || 0,
          paymentMethod: data.paymentMethod,
          orderNotes: data.orderNotes,
          customerInfo: data.customerInfo,
          deliveryAddress: data.deliveryAddress,
          items: state.items // Include cart items with variation data
        };
        
        localStorage.setItem('lastOrder', JSON.stringify(orderData));
        
        toast({
          title: "Order placed successfully! 🎉",
          description: `Your order #${result.orderNumber} has been confirmed. ${result.pointsEarned ? `You earned ${result.pointsEarned} loyalty points!` : ''}`,
        });
        
        // Mark checkout as successful to prevent cart redirect
        setCheckoutSuccess(true);
        
        // Navigate to thank you page (cart will be cleared there)
        router.push('/thank-you');
      } else {
        throw new Error('Order processing failed');
      }
      
    } catch (error: any) {
      console.error('Order processing error:', error);
      toast({
        title: "Order failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Redirect to cart if empty (but not after successful checkout)
  if (state.items.length === 0 && !state.isLoading && !checkoutSuccess) {
    router.push('/cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Checkout" />
      
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Stock Validation Errors */}
        {stockValidationErrors.length > 0 && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg">
            <div className="flex items-start gap-3">
              <div className="text-destructive mt-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-2">Insufficient Stock</h3>
                <ul className="space-y-1 text-sm text-destructive">
                  {stockValidationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
                <p className="mt-3 text-sm font-medium">
                  Please update your cart before proceeding with checkout.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stock Validation Loading */}
        {isValidatingStock && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
              <p className="text-sm text-blue-900">Validating stock availability...</p>
            </div>
          </div>
        )}

        {isProcessing ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-xl font-semibold">Processing your order...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your order</p>
            {loyaltySettings.enabled && (
              <p className="text-sm text-muted-foreground">
                🎁 Loyalty points will be awarded when your order is completed!
              </p>
            )}
          </div>
        ) : (
          <CheckoutFormWithData
            total={total}
            loyaltySettings={loyaltySettings}
            customerPoints={customerPoints}
            orderSettings={orderSettings}
            shippingStatus={shippingStatus}
            deliveryStatus={deliveryStatus}
            onSubmit={handleCheckoutSubmit}
          />
        )}
      </main>
      <MobileNav />
    </div>
  );
}