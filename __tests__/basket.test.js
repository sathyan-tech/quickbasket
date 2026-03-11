// __tests__/basket.test.js - Jest unit tests for basket functionality

describe('Basket Functionality', () => {
  let basket;

  beforeEach(() => {
    basket = new Basket(); // Assuming Basket is a class that handles basket operations
  });

  test('should add an item to the basket', () => {
    basket.addItem({ id: 1, name: 'Apple', price: 0.99 });
    expect(basket.getItems()).toHaveLength(1);
    expect(basket.getItems()[0]).toEqual({ id: 1, name: 'Apple', price: 0.99 });
  });

  test('should remove an item from the basket', () => {
    basket.addItem({ id: 1, name: 'Apple', price: 0.99 });
    basket.removeItem(1);
    expect(basket.getItems()).toHaveLength(0);
  });

  test('should clear the basket', () => {
    basket.addItem({ id: 1, name: 'Apple', price: 0.99 });
    basket.clear();
    expect(basket.getItems()).toHaveLength(0);
  });

  test('should calculate total price of items in the basket', () => {
    basket.addItem({ id: 1, name: 'Apple', price: 0.99 });
    basket.addItem({ id: 2, name: 'Banana', price: 0.79 });
    expect(basket.getTotalPrice()).toBe(1.78);
  });
});