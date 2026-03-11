describe('Price Comparison Functionality', () => {
    it('should compare prices between two products', () => {
        // Visit the product pages
        cy.visit('http://example.com/product1');
        // Grab the price of the first product
        const price1 = cy.get('.product-price').invoke('text');

        cy.visit('http://example.com/product2');
        // Grab the price of the second product
        const price2 = cy.get('.product-price').invoke('text');

        // Compare prices
        cy.wrap(price1).should('not.equal', price2);
    });
});