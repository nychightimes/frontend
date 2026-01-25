export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image: string;
  videoUrl?: string | null;
  description: string;
  thc: number;
  cbd: number;
  strain: 'indica' | 'sativa' | 'hybrid';
  inStock: boolean;
  // Price range information for variable products
  minPrice?: number | null;
  maxPrice?: number | null;
  isVariableProduct?: boolean;
  // Optional variant information
  variantId?: string;
  variantSku?: string;
  selectedAttributes?: { [key: string]: string };
  // Inventory information
  availableQuantity?: number;
  availableWeight?: number; // in grams
  stockManagementType?: 'quantity' | 'weight';
  pricePerUnit?: number; // Price per gram for weight-based products
  baseWeightUnit?: string; // 'grams' or 'kg'
}

export interface CartItem {
  /** Unique cart line id (allows multiple lines for same product/variant with different notes) */
  id: string;
  product: Product;
  quantity: number;
  numericValue?: number; // For weight-based products: the actual weight in grams (e.g., 100, 250, 500)
  /** Optional per-line multi-line note (max 500 chars enforced in UI) */
  note?: string;
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  paymentMethod: 'cod' | 'gateway' | 'crypto';
  orderNotes?: string;
  deliveryAddress: Address;
  createdAt: Date;
  eta?: Date;
  driverId?: string;
  loyaltyPointsEarned: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  instructions?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'driver' | 'admin';
  loyaltyPoints: number;
  referralCode: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email: string;
  isAvailable: boolean;
  currentOrders: string[];
  rating: number;
}

export interface DeliveryUpdate {
  orderId: string;
  status: string;
  eta: Date;
  location?: { lat: number; lng: number };
  message?: string;
}

export interface LoyaltySettings {
  enabled: boolean;
  earningRate: number;
  earningBasis: 'subtotal' | 'total';
  redemptionValue: number;
  expiryMonths: number;
  minimumOrder: number;
  maxRedemptionPercent: number;
  redemptionMinimum: number;
}

export interface CustomerPoints {
  availablePoints: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
}