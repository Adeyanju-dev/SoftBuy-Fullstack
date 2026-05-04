# SoftBuy Fullstack

SoftBuy is a fullstack e-commerce project with a Django REST backend and a React + Vite frontend. It covers authentication, product browsing, cart and checkout flows, orders, seller tools, and Paystack-based card payments.

## Stack

- Backend: Django, Django REST Framework, PostgreSQL
- Frontend: React, Vite, Tailwind CSS
- Payments: Paystack
- Media: Cloudinary

## Project Structure

```text
SoftBuy-Fullstack/
|-- SoftBuy/                     # Django backend
|-- Softbuy2/ecommerce-frontend/ # React frontend
```

## Backend Setup

```bash
cd SoftBuy
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create your backend env file from the example:

```bash
copy .env.example .env
```

Update `.env` with your real database, Paystack, email, and Cloudinary values, then run:

```bash
python manage.py migrate
python manage.py runserver
```

## Frontend Setup

```bash
cd Softbuy2/ecommerce-frontend
npm install
npm run dev
```

## Important Env Notes

- Set `FRONTEND_URL` to the frontend origin that should receive payment returns.
- Keep `PAYSTACK_CALLBACK_URL` as a frontend path such as `/verify-payment`.
- For local development, the default frontend URL is `http://localhost:5173`.

## Verification

Useful checks before upgrading:

```bash
cd SoftBuy
venv\Scripts\python.exe manage.py check
venv\Scripts\python.exe manage.py test payments.tests.PaymentAPITests

cd ..\Softbuy2\ecommerce-frontend
npm run lint
npm run build
```
