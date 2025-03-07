# E-conomic API Integration

A comprehensive Node.js application that synchronizes business data between E-conomic's REST API and a custom database.

## Overview

This application provides a bridge between the E-conomic accounting system and local databases, enabling organizations to maintain synchronized business data across platforms. Built with a modular architecture, it handles various business entities including invoices, products, suppliers, payment terms, and more.

## Key Features

- **Multi-tenant Support**: Simultaneously handles multiple E-conomic agreements
- **Complete Data Synchronization**: Supports invoices, products, product groups, suppliers, VAT accounts, accounting years, and more
- **Data Transformation**: Maps API structures to optimized local database schemas
- **Comprehensive Error Handling**: Robust error handling with detailed logging
- **REST API Interface**: Exposes synchronized data through a well-documented API
- **Sync Logging**: Detailed tracking of synchronization operations
- **Agreement Management**: Secure storage and validation of API credentials

## Technical Stack

- **Backend**: Node.js with Express
- **Database**: MySQL/MariaDB with migration support
- **API Client**: Custom-built E-conomic API client with pagination handling
- **Authentication**: Token-based authentication for API access
- **Error Handling**: Centralized error handling with custom error classes
- **Logging**: Winston-based logging with file and console transports

## Architecture

The application follows a modular architecture where each business entity has its own:
- Model - Database operations
- Service - Business logic and API integration
- Controller - API endpoint handling
- Routes - REST API definition

## Database Management

- **Migrations**: Versioned database schema changes
- **Transactions**: ACID-compliant data operations
- **Connection Pooling**: Optimized database connection management

## Development Status

This project is in active development
