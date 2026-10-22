import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, X, Plus, Minus, CreditCard, Smartphone, Gift, Check, Coffee } from 'lucide-react';

// --- TYPES ---
type Category = 'Milk Teas' | 'Fruit Teas' | 'Smoothies' | 'Signature Mixes' | 'Seasonal Items';

interface Drink {
  id: string;
  name: string;
  category: Category;
  basePrice: number;
  image: string;
  description: string;
}

interface Topping {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  id: string;
  drink: Drink;
  iceLevel: string;
  sugarLevel: string;
  toppings: Topping[];
  quantity: number;
  totalPrice: number;
}

// --- MOCK DATABASE ---
const DB_TOPPINGS: Topping[] = [
  { id: 't1', name: 'Tapioca Pearl', price: 0.75 },
  { id: 't2', name: 'Lychee Jelly', price: 0.75 },
  { id: 't3', name: 'Pudding', price: 0.75 },
  { id: 't4', name: 'Aloe Vera', price: 0.75 },
  { id: 't5', name: 'Brown Sugar Boba', price: 1.00 },
];

const DB_MENU: Drink[] = [
  // Milk Teas
  { id: 'd1', name: 'Classic Milk Tea', category: 'Milk Teas', basePrice: 4.50, image: '🧋', description: 'Signature black tea with creamy milk.' },
  { id: 'd2', name: 'Taro Milk Tea', category: 'Milk Teas', basePrice: 5.00, image: '🍠', description: 'Sweet and creamy taro root blend.' },
  { id: 'd3', name: 'Matcha Latte', category: 'Milk Teas', basePrice: 5.25, image: '🍵', description: 'Premium grade matcha with whole milk.' },
  { id: 'd4', name: 'Oolong Milk Tea', category: 'Milk Teas', basePrice: 4.75, image: '🍂', description: 'Roasted oolong tea with creamy milk.' },
  
  // Fruit Teas
  { id: 'd5', name: 'Mango Green Tea', category: 'Fruit Teas', basePrice: 4.75, image: '🥭', description: 'Jasmine green tea with mango puree.' },
  { id: 'd6', name: 'Passionfruit Black', category: 'Fruit Teas', basePrice: 4.75, image: '🌺', description: 'Tangy passionfruit with robust black tea.' },
  { id: 'd7', name: 'Peach Oolong', category: 'Fruit Teas', basePrice: 5.00, image: '🍑', description: 'Sweet peach flavors with roasted oolong.' },
  
  // Smoothies
  { id: 'd8', name: 'Strawberry Banana', category: 'Smoothies', basePrice: 6.00, image: '🍓', description: 'Fresh strawberries and banana blended.' },
  { id: 'd9', name: 'Avocado Smash', category: 'Smoothies', basePrice: 6.50, image: '🥑', description: 'Rich avocado with condensed milk.' },
  { id: 'd10', name: 'Taro Slush', category: 'Smoothies', basePrice: 6.00, image: '🧊', description: 'Ice blended sweet taro root.' },
  
  // Signature Mixes
  { id: 'd11', name: 'Brown Sugar Deerioca', category: 'Signature Mixes', basePrice: 6.00, image: '🦌', description: 'Tiger stripes of brown sugar syrup.' },
  { id: 'd12', name: 'Galaxy Lemonade', category: 'Signature Mixes', basePrice: 5.50, image: '🌌', description: 'Color-changing butterfly pea flower lemonade.' },
  
  // Seasonal
  { id: 'd13', name: 'Wintermelon Frost', category: 'Seasonal Items', basePrice: 5.50, image: '❄️', description: 'Icy and sweet wintermelon slush.' },
  { id: 'd14', name: 'Pumpkin Spice Boba', category: 'Seasonal Items', basePrice: 6.25, image: '🎃', description: 'Fall favorite with chewy tapioca.' },
];

// --- REUSABLE COMPONENTS ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "font-bold rounded-2xl py-4 px-6 transition-transform active:scale-95 flex items-center justify-center text-xl w-full shadow-md select-none";
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 disabled:bg-gray-400",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300",
    outline: "border-2 border-black text-black hover:bg-gray-50",
    success: "bg-green-600 text-white hover:bg-green-700",
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

const ModalOverlay = ({ children, onClose }: any) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8 animate-in fade-in duration-200">
    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-200">
      <button onClick={onClose} className="absolute top-6 right-6 p-3 bg-gray-100 rounded-full hover:bg-gray-200 z-10 transition-colors">
        <X size={32} />
      </button>
      {children}
    </div>
  </div>
);

// --- MODALS ---

const CustomizationModal = ({ drink, toppingsList, onClose, onAddToCart }: { drink: Drink, toppingsList: Topping[], onClose: () => void, onAddToCart: (item: CartItem) => void }) => {
  const [ice, setIce] = useState('100%');
  const [sugar, setSugar] = useState('100%');
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  const [quantity, setQuantity] = useState(1);

  const ICE_LEVELS = ['0%', '25%', '50%', '75%', '100%'];
  const SUGAR_LEVELS = ['0%', '25%', '50%', '75%', '100%', '150%', '200%'];

  const toggleTopping = (topping: Topping) => {
    setSelectedToppings(prev => 
      prev.find(t => t.id === topping.id) ? prev.filter(t => t.id !== topping.id) : [...prev, topping]
    );
  };

  const totalPrice = useMemo(() => {
    const toppingTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
    return (drink.basePrice + toppingTotal) * quantity;
  }, [drink.basePrice, selectedToppings, quantity]);

  const handleAdd = () => {
    onAddToCart({
      id: Math.random().toString(36).substr(2, 9),
      drink,
      iceLevel: ice,
      sugarLevel: sugar,
      toppings: selectedToppings,
      quantity,
      totalPrice
    });
  };

  const OptionGroup = ({ title, options, selected, onSelect }: any) => (
    <div className="mb-8">
      <h3 className="text-xl font-bold mb-4 text-gray-800">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {options.map((opt: string) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={`px-6 py-4 rounded-2xl font-bold text-lg border-2 transition-all ${selected === opt ? 'border-black bg-black text-white shadow-lg' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex h-full">
        {/* Left Info Column */}
        <div className="w-1/3 bg-gray-50 p-10 flex flex-col items-center text-center justify-center border-r border-gray-100">
          <div className="text-9xl mb-8 drop-shadow-xl">{drink.image}</div>
          <h2 className="text-4xl font-black mb-4">{drink.name}</h2>
          <p className="text-gray-500 text-lg mb-8">{drink.description}</p>
          <div className="text-4xl font-bold text-gray-800">${drink.basePrice.toFixed(2)}</div>
        </div>
        
        {/* Right Customization Column */}
        <div className="w-2/3 p-10 overflow-y-auto bg-white flex flex-col relative hide-scrollbar">
          <OptionGroup title="Ice Level" options={ICE_LEVELS} selected={ice} onSelect={setIce} />
          <OptionGroup title="Sugar Level" options={SUGAR_LEVELS} selected={sugar} onSelect={setSugar} />
          
          <div className="mb-24">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Toppings</h3>
            <div className="grid grid-cols-2 gap-4">
              {toppingsList.map(topping => {
                const isSelected = selectedToppings.some(t => t.id === topping.id);
                return (
                  <button
                    key={topping.id}
                    onClick={() => toggleTopping(topping)}
                    className={`flex flex-col items-start justify-between p-5 rounded-2xl border-2 transition-all ${isSelected ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                  >
                    <div className="flex justify-between w-full mb-2">
                       <span className="font-bold text-lg">{topping.name}</span>
                       {isSelected && <Check size={24} />}
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>+ ${topping.price.toFixed(2)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 flex items-center justify-between gap-6 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
            <div className="flex items-center bg-gray-100 rounded-2xl p-2 h-[72px]">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-14 h-full bg-white rounded-xl shadow-sm flex items-center justify-center hover:bg-gray-50"><Minus size={24} /></button>
              <span className="w-16 text-center text-2xl font-bold">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-14 h-full bg-white rounded-xl shadow-sm flex items-center justify-center hover:bg-gray-50"><Plus size={24} /></button>
            </div>
            <Button onClick={handleAdd} className="flex-1 h-[72px] text-2xl">
              Add to Order - ${totalPrice.toFixed(2)}
            </Button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};

const CheckoutModal = ({ cart, total, onClose, onComplete }: any) => {
  const [discountCode, setDiscountCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountMsg, setDiscountMsg] = useState({ text: '', type: '' });
  const [step, setStep] = useState<'review' | 'payment' | 'processing'>('review');

  const tax = total * 0.0825; 
  const finalTotal = total + tax - discount;

  const handleApplyDiscount = () => {
    if (discountCode.trim().toUpperCase() === 'BOBA10') {
      setDiscount(total * 0.1);
      setDiscountMsg({ text: '10% Discount Applied!', type: 'success' });
    } else {
      setDiscount(0);
      setDiscountMsg({ text: 'Invalid promo code.', type: 'error' });
    }
  };

  const handlePayment = () => {
    setStep('processing');
    setTimeout(() => {
      onComplete();
    }, 2000);
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="p-12 h-full flex flex-col">
        {step === 'review' && (
          <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
            <h2 className="text-4xl font-black mb-8 text-center">Order Summary</h2>
            
            <div className="bg-gray-50 p-8 rounded-3xl mb-8 flex-1 overflow-y-auto">
              {cart.map((item: CartItem, i: number) => (
                <div key={i} className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 last:border-0">
                   <div>
                      <p className="text-xl font-bold">{item.quantity}x {item.drink.name}</p>
                      <p className="text-sm text-gray-500">{item.toppings.length} toppings added</p>
                   </div>
                   <p className="text-xl font-bold">${item.totalPrice.toFixed(2)}</p>
                </div>
              ))}
              
              <div className="mt-8 space-y-4">
                <div className="flex justify-between text-xl text-gray-600"><span>Subtotal</span><span>${total.toFixed(2)}</span></div>
                <div className="flex justify-between text-xl text-gray-600"><span>Tax (8.25%)</span><span>${tax.toFixed(2)}</span></div>
                {discount > 0 && <div className="flex justify-between text-xl text-green-600 font-bold"><span>Discount (BOBA10)</span><span>-${discount.toFixed(2)}</span></div>}
              </div>
              
              <div className="border-t-4 border-gray-200 my-6 pt-6 flex justify-between text-4xl font-black">
                <span>Total</span><span>${Math.max(0, finalTotal).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-8">
              <div className="flex gap-4">
                <input 
                  type="text" 
                  placeholder="Promo Code (Try BOBA10)" 
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  className="flex-1 text-xl p-5 rounded-2xl border-2 border-gray-200 focus:border-black outline-none transition-colors uppercase"
                />
                <Button variant="secondary" onClick={handleApplyDiscount} className="!w-auto px-10">Apply</Button>
              </div>
              {discountMsg.text && (
                 <p className={`font-bold ml-2 ${discountMsg.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                   {discountMsg.text}
                 </p>
              )}
            </div>

            <Button onClick={() => setStep('payment')} className="py-6 text-2xl h-[80px]">Continue to Payment</Button>
          </div>
        )}

        {step === 'payment' && (
          <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
             <h2 className="text-4xl font-black mb-4">How would you like to pay?</h2>
             <h3 className="text-2xl font-bold mb-12 text-gray-500">Amount Due: ${Math.max(0, finalTotal).toFixed(2)}</h3>
             <div className="grid grid-cols-2 gap-6 w-full">
                <Button variant="outline" onClick={handlePayment} className="py-16 flex flex-col gap-6 text-2xl group">
                  <CreditCard size={56} className="text-gray-400 group-hover:text-black transition-colors" /> Credit / Debit
                </Button>
                <Button variant="outline" onClick={handlePayment} className="py-16 flex flex-col gap-6 text-2xl bg-black text-white hover:bg-gray-800 border-black">
                   <Smartphone size={56} /> Apple Pay
                </Button>
                <Button variant="outline" onClick={handlePayment} className="py-16 flex flex-col gap-6 text-2xl group">
                   <Smartphone size={56} className="text-gray-400 group-hover:text-black transition-colors" /> Google Pay
                </Button>
                <Button variant="outline" onClick={handlePayment} className="py-16 flex flex-col gap-6 text-2xl group">
                   <Gift size={56} className="text-gray-400 group-hover:text-black transition-colors" /> Gift Card
                </Button>
             </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
            <div className="w-32 h-32 border-8 border-gray-100 border-t-black rounded-full animate-spin mb-8"></div>
            <h3 className="text-4xl font-black">Processing Payment...</h3>
            <p className="text-xl text-gray-500 mt-4">Please do not remove your card.</p>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

// --- MAIN APP ---
export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);

  // Derive categories from DB_MENU to ensure accurate horizontal sections
  const categories: Category[] = ['Milk Teas', 'Fruit Teas', 'Smoothies', 'Signature Mixes', 'Seasonal Items'];
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleAddToCart = (item: CartItem) => {
    setCart([...cart, item]);
    setSelectedDrink(null);
  };

  const handleRemoveFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const completeOrder = () => {
    setCart([]);
    setIsCheckoutOpen(false);
    setOrderComplete(true);
    setTimeout(() => setOrderComplete(false), 6000); 
  };

  return (
    <div className="flex h-screen w-screen bg-[#f0f0f5] font-sans overflow-hidden select-none text-gray-900">
      
      {/* LEFT: Main UI (Strict Horizontal Scroll) */}
      <main className="flex-1 flex flex-col min-w-0"> 
        {/* Header */}
        <header className="h-24 px-10 bg-white shadow-sm z-10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center text-white text-3xl font-black">
              B
            </div>
            <h1 className="text-4xl font-black tracking-tighter">Boba Shack</h1>
          </div>
          <div className="bg-gray-100 px-8 py-3 rounded-full font-bold text-gray-500 text-lg">
            Scroll Right to Explore ➔
          </div>
        </header>

        {/* Horizontal Scroll Container - NO VERTICAL SCROLLING */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-row flex-nowrap snap-x snap-mandatory scroll-smooth hide-scrollbar p-10 gap-16 items-center">
          
          {categories.map(category => {
            const drinksInCategory = DB_MENU.filter(d => d.category === category);
            if (drinksInCategory.length === 0) return null;
            
            return (
              <div key={category} className="flex-none flex flex-row items-center gap-8 h-full py-4 snap-start">
                
                {/* Vertical Category Header Label */}
                <div className="h-full max-h-[600px] w-24 bg-black rounded-3xl flex items-center justify-center shadow-xl relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-black opacity-50"></div>
                   <h2 
                     className="text-4xl font-black text-white tracking-[0.2em] uppercase z-10" 
                     style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                   >
                     {category}
                   </h2>
                </div>

                {/* Grid of Drinks (2 rows, fills vertically, expands horizontally) */}
                <div className="grid grid-rows-2 grid-flow-col gap-6 h-full max-h-[600px]">
                  {drinksInCategory.map(drink => (
                    <div 
                      key={drink.id} 
                      onClick={() => setSelectedDrink(drink)}
                      className="w-72 bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer border border-gray-100 flex flex-col group active:scale-95"
                    >
                      <div className="text-7xl text-center mb-4 pt-2 drop-shadow-md">{drink.image}</div>
                      <h3 className="text-2xl font-bold leading-tight mb-2">{drink.name}</h3>
                      <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">{drink.description}</p>
                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                        <span className="text-2xl font-black">${drink.basePrice.toFixed(2)}</span>
                        <div className="bg-black text-white p-3 rounded-full group-hover:scale-110 transition-transform">
                          <Plus size={24} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            );
          })}
          
          {/* End padding for smooth scrolling finish */}
          <div className="w-8 shrink-0"></div>
        </div>
      </main>

      {/* RIGHT: Persistent Cart Sidebar */}
      <aside className="w-[450px] bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-20 flex flex-col shrink-0">
        <div className="p-8 border-b border-gray-100 bg-white">
          <h2 className="text-3xl font-black flex items-center gap-3">
            <ShoppingCart size={36} /> My Order
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart size={80} className="mb-6 opacity-20" />
              <p className="text-2xl font-medium">Your cart is empty</p>
              <p className="text-center mt-2 text-gray-400">Tap a drink to get started!</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 animate-in slide-in-from-right-4 duration-300 relative group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-xl font-bold pr-10 leading-tight">{item.quantity}x {item.drink.name}</h4>
                  <button 
                    onClick={() => handleRemoveFromCart(item.id)} 
                    className="absolute top-4 right-4 text-gray-300 hover:text-red-500 bg-gray-50 hover:bg-red-50 rounded-full p-2 transition-colors"
                  >
                    <X size={20}/>
                  </button>
                </div>
                <div className="text-gray-500 text-sm mb-3 pr-8">
                  <p>Ice: {item.iceLevel} | Sugar: {item.sugarLevel}</p>
                  {item.toppings.length > 0 && <p className="mt-1 font-medium text-gray-600">+{item.toppings.map(t=>t.name).join(', ')}</p>}
                </div>
                <div className="text-xl font-black text-right">${item.totalPrice.toFixed(2)}</div>
              </div>
            ))
          )}
        </div>

        <div className="p-8 bg-white border-t border-gray-100 pb-10">
          <div className="flex justify-between text-2xl font-bold mb-6">
            <span>Subtotal</span>
            <span>${cartTotal.toFixed(2)}</span>
          </div>
          <Button onClick={() => setIsCheckoutOpen(true)} disabled={cart.length === 0} className="py-6 text-2xl h-[80px]">
            Checkout
          </Button>
        </div>
      </aside>

      {/* Modals */}
      {selectedDrink && (
        <CustomizationModal 
          drink={selectedDrink} 
          toppingsList={DB_TOPPINGS}
          onClose={() => setSelectedDrink(null)} 
          onAddToCart={handleAddToCart} 
        />
      )}

      {isCheckoutOpen && (
        <CheckoutModal 
          cart={cart}
          total={cartTotal}
          onClose={() => setIsCheckoutOpen(false)}
          onComplete={completeOrder}
        />
      )}

      {/* Success Overlay */}
      {orderComplete && (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="w-40 h-40 bg-green-500 rounded-full flex items-center justify-center mb-10 animate-bounce">
              <Check size={100} className="text-white" />
           </div>
           <h1 className="text-7xl font-black mb-6">Order Complete!</h1>
           <p className="text-3xl text-gray-400 font-medium">Please take your receipt.</p>
           <p className="text-2xl text-gray-500 mt-4">We will call your number shortly.</p>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />
    </div>
  );
}