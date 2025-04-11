# Expense & Production Tracker

A simplified web application for tracking business expenses, managing product inventory, monitoring production, and recording sales transactions.

## Features

- **User Authentication**: Secure login for two admin accounts (ILIASS and YASSIR)
- **Expense Tracking**: Add, edit, and delete expenses with categories
- **Product Management**: Track products with name, type, cost price, and selling price
- **Production Monitoring**: Record quantity produced with dates
- **Sales Recording**: Document sales transactions with clients
- **Responsive Design**: Works on desktop and mobile devices

## Installation

1. Make sure you have [Node.js](https://nodejs.org/) installed (version 14 or higher)
2. Extract the zip file to a directory of your choice
3. Open a terminal/command prompt in that directory
4. Install dependencies:

```bash
npm install
```

## Running the Application

Start the application with:

```bash
npm start
```

The application will be available at http://localhost:3000

For development with auto-restart on file changes:

```bash
npm run dev
```

## Default Login Credentials

The application comes with two pre-configured admin accounts:

- Username: ILIASS, Password: admin123
- Username: YASSIR, Password: admin123

## Database

The application uses SQLite for data storage. The database file (`database.db`) will be created automatically when you first run the application. No additional database setup is required.

## Usage Guide

### Dashboard

The dashboard provides an overview of your business data with quick access to all features.

### Expenses

- View all expenses with filtering options
- Add new expenses with amount, category, description, and date
- Edit or delete existing expenses

### Products

- Manage your product catalog
- Add products with name, type, cost price, and selling price
- Edit or delete products

### Production

- Record production activities
- Track quantity produced for each product
- Filter production records by product and date

### Sales

- Document sales transactions
- Record client information, product, quantity, and amount
- View sales history with filtering options

## Deployment Options

### Local Network Deployment

To make the application available on your local network:

1. Find your computer's IP address
2. Run the application with:

```bash
npm start
```

3. Other devices on the same network can access the application at http://YOUR_IP_ADDRESS:3000

### Cloud Deployment

For cloud deployment, you can use services like:

- [Heroku](https://www.heroku.com/)
- [Render](https://render.com/)
- [Railway](https://railway.app/)

Follow their documentation for deploying Node.js applications.

## Security Considerations

For production use:

1. Change the JWT secret in server.js
2. Set up HTTPS
3. Implement proper user management with password reset functionality
4. Consider adding additional authentication methods

## License

This application is provided for your business use.

## Support

For any questions or issues, please contact the developer.
