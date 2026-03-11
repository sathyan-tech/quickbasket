// Cypress end-to-end smoke tests

describe('Smoke Tests', () => {
    it('Visits the homepage', () => {
        cy.visit('http://localhost:3000'); // Update with your app URL
        cy.contains('Welcome'); // Check for welcome text
    });

    it('Checks login functionality', () => {
        cy.visit('http://localhost:3000/login');
        cy.get('input[name=email]').type('test@example.com'); // Update with a valid email
        cy.get('input[name=password]').type('password123'); // Update with valid password
        cy.get('form').submit();
        cy.url().should('include', '/dashboard'); // Check for redirect
    });

    it('Verifies product display', () => {
        cy.visit('http://localhost:3000/products');
        cy.get('.product').should('have.length.greaterThan', 0); // Ensure products are displayed
    });
});