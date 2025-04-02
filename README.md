# Stripe Subscription System

This project implements a Stripe subscription system, including user creation, product selection, and payment verification using Stripe webhooks.

## Prerequisites

- Node.js installed on your system
- A Stripe account
- Stripe CLI for testing webhooks

## Installation

1. **Clone the Repository**
   ```sh
   git clone https://github.com/Jaiswal-Aakash/stripe.git
   cd stripe
   ```

2. **Install Dependencies**
   ```sh
   npm install
   ```

## Running the Project

### 1. Install and Configure Stripe CLI

Stripe CLI is required to test webhook events locally.

- Download and install Stripe CLI from [here](https://github.com/stripe/stripe-cli/releases/tag/v1.25.1).
- Log in to Stripe CLI:
  ```sh
  stripe login
  ```
- Forward webhook events to your local server:
  ```sh
  stripe listen --forward-to localhost:5000/webhook
  ```
  Replace `5000` with your backend server port if different.
  ```
  add a serviceAccountKey.json in backend root directory

### 2. Run the Backend
```sh
npm run dev
```

### 3. Run the Frontend
```sh
npm run dev
```

## Testing Payments

Once everything is running, you can proceed to test payments using Stripe's test mode.

For any issues, check the Stripe logs or CLI for debugging errors.

