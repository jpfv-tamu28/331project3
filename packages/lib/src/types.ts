export type Category = 'Milk Teas' | 'Fruit Teas' | 'Smoothies' | 'Signature Mixes' | 'Seasonal Items';

export interface DrinkDTO {
  id: string;
  name: string;
  category: Category;
  basePrice: number;
  description: string;
}

export interface OrderPayload {
  items: {
    drinkId: string;
    quantity: number;
    iceLevel: string;
    sugarLevel: string;
  }[];
  discountCode?: string;
}