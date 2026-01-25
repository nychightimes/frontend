'use client'

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { CartItem, Product } from '@/types';

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  isLoading: boolean;
}

type CartAction =
  | { type: 'ADD_TO_CART'; payload: { product: Product; quantity: number; numericValue?: number; note?: string } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { lineId: string; quantity: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] }
  | { type: 'SET_LOADING'; payload: boolean };

interface CartContextType {
  state: CartState;
  addToCart: (product: Product, quantity: number, numericValue?: number, note?: string) => void;
  removeFromCart: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const normalizeNote = (note?: string): string | undefined => {
  if (typeof note !== 'string') return undefined;
  const trimmed = note.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const generateLineId = (): string => {
  try {
    // Modern browsers
    if (globalThis.crypto && 'randomUUID' in globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  // Fallback
  return `line_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const migrateCartItems = (raw: unknown): CartItem[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item: any): CartItem | null => {
      if (!item || typeof item !== 'object') return null;
      if (!item.product || typeof item.product !== 'object') return null;

      const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : generateLineId();
      const quantity = typeof item.quantity === 'number' ? item.quantity : Number(item.quantity) || 0;
      const numericValue =
        typeof item.numericValue === 'number'
          ? item.numericValue
          : item.numericValue !== undefined && item.numericValue !== null
            ? Number(item.numericValue)
            : undefined;

      const note = normalizeNote(item.note);

      return {
        id,
        product: item.product as Product,
        quantity,
        numericValue: Number.isFinite(numericValue as number) ? (numericValue as number) : undefined,
        note,
      };
    })
    .filter((x): x is CartItem => !!x && x.quantity > 0);
};

const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + (item.product.price * item.quantity), 0);
};

const calculateItemCount = (items: CartItem[]): number => {
  return items.reduce((count, item) => count + item.quantity, 0);
};

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const { product, quantity, numericValue, note } = action.payload;
      const normalizedNote = normalizeNote(note);
      const variantId = product.variantId ?? null;
      const numericKey = numericValue ?? null;

      const existingItem = state.items.find(item =>
        item.product.id === product.id &&
        (item.product.variantId ?? null) === variantId &&
        (item.numericValue ?? null) === numericKey &&
        normalizeNote(item.note) === normalizedNote
      );
      
      let newItems: CartItem[];
      if (existingItem) {
        newItems = state.items.map(item => {
          const isMatch =
            item.product.id === product.id &&
            (item.product.variantId ?? null) === variantId &&
            (item.numericValue ?? null) === numericKey &&
            normalizeNote(item.note) === normalizedNote;

          return isMatch
            ? {
                ...item,
                quantity: item.quantity + quantity,
                numericValue: numericValue ?? item.numericValue,
              }
            : item;
        });
      } else {
        newItems = [
          ...state.items,
          { id: generateLineId(), product, quantity, numericValue, note: normalizedNote },
        ];
      }
      
      return {
        items: newItems,
        total: calculateTotal(newItems),
        itemCount: calculateItemCount(newItems),
        isLoading: state.isLoading,
      };
    }
    
    case 'REMOVE_FROM_CART': {
      const newItems = state.items.filter(item => item.id !== action.payload);
      return {
        items: newItems,
        total: calculateTotal(newItems),
        itemCount: calculateItemCount(newItems),
        isLoading: state.isLoading,
      };
    }
    
    case 'UPDATE_QUANTITY': {
      const { lineId, quantity } = action.payload;
      if (quantity <= 0) {
        const newItems = state.items.filter(item => item.id !== lineId);
        return {
          items: newItems,
          total: calculateTotal(newItems),
          itemCount: calculateItemCount(newItems),
          isLoading: state.isLoading,
        };
      }
      
      const newItems = state.items.map(item =>
        item.id === lineId
          ? { ...item, quantity }
          : item
      );
      
      return {
        items: newItems,
        total: calculateTotal(newItems),
        itemCount: calculateItemCount(newItems),
        isLoading: state.isLoading,
      };
    }
    
    case 'CLEAR_CART':
      return {
        items: [],
        total: 0,
        itemCount: 0,
        isLoading: false,
      };
    
    case 'LOAD_CART': {
      const items = action.payload;
      return {
        items,
        total: calculateTotal(items),
        itemCount: calculateItemCount(items),
        isLoading: false,
      };
    }
    
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    
    default:
      return state;
  }
};

const initialState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
  isLoading: true,
};

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      try {
        const cartItems = migrateCartItems(JSON.parse(savedCart));
        dispatch({ type: 'LOAD_CART', payload: cartItems });
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(state.items));
  }, [state.items]);

  const addToCart = (product: Product, quantity: number, numericValue?: number, note?: string) => {
    dispatch({ type: 'ADD_TO_CART', payload: { product, quantity, numericValue, note } });
  };

  const removeFromCart = (lineId: string) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: lineId });
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { lineId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  const getCartTotal = () => state.total;
  
  const getCartItemCount = () => state.itemCount;

  const value: CartContextType = {
    state,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getCartTotal,
    getCartItemCount,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}