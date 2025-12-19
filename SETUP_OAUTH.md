# Google OAuth & Geolocation Setup Guide

This guide explains how to configure Google OAuth2 and Google Maps integration for the PetMatch project.

## Prerequisites

1.  **Google Cloud Console Account**: You need a project in the [Google Cloud Console](https://console.cloud.google.com/).
2.  **Enabled APIs**:
    *   **Google Identity** (for OAuth2).
    *   **Google Maps JavaScript API** (for frontend map/places).
    *   **Google Places API (New)** or **Places API** (for Autocomplete).
    *   **Google Geocoding API** (for converting Place IDs to coordinates).

## Backend Configuration

1.  **Credentials**:
    *   Go to **APIs & Services > Credentials**.
    *   Create **OAuth 2.0 Client IDs**.
    *   **Application Type**: Web application.
    *   **Authorized JavaScript Origins**: `http://localhost:5173` (or your frontend URL).
    *   **Authorized Redirect URIs**: `http://localhost:5173` (for implicit flow/postmessage) and `postmessage`.

2.  **Environment Variables**:
    Update `backend/.env`:
    ```env
    GOOGLE_CLIENT_ID=your_client_id_from_console
    GOOGLE_CLIENT_SECRET=your_client_secret_from_console
    GOOGLE_REDIRECT_URI=postmessage
    ```

## Frontend Configuration

1.  **API Keys**:
    *   Go to **APIs & Services > Credentials**.
    *   Create an **API Key**.
    *   **Restrict the key** (Recommended):
        *   **Application restrictions**: HTTP referrers (websites) -> Add `http://localhost:5173/*`.
        *   **API restrictions**: Select Maps JavaScript API, Places API, Geocoding API.

2.  **Environment Variables**:
    Update `frontendv2/.env`:
    ```env
    VITE_GOOGLE_CLIENT_ID=your_client_id_from_console (Same as backend)
    VITE_GOOGLE_MAPS_API_KEY=your_api_key_from_console
    ```
 You're looking for your Google Maps API Key, which is essential for using Google Maps Platform services in your application. Here's how you can find and create one in the Google Cloud Console:

    Access the Google Cloud Console: Go to the Google Cloud Console. Make sure you've selected the correct project for your application (e.g., petmatch-481720 ).
    Navigate to "APIs & Services" > "Credentials": In the left-hand navigation menu, select "APIs & Services," then click on "Credentials."
    Create an API Key:
        Click the "Create credentials" button at the top of the Credentials page.
        From the dropdown menu, select "API key."
        A dialog box will appear displaying your newly generated API key. Copy this key immediately. This is the value you'll use for VITE_GOOGLE_MAPS_API_KEY . 
    Enable Necessary APIs: For your Google Maps API key to work, you need to ensure the specific Google Maps Platform APIs your application will use are enabled for your project. Common ones include:
        Maps JavaScript API (for web-based maps)
        Geocoding API
        Places API
        You can enable these by going to "APIs & Services" > "Library," searching for the specific API, and clicking "Enable." 
    Restrict Your API Key (Highly Recommended): To secure your API key and prevent unauthorized use, you should restrict it.
        Back on the "Credentials" page, click on the name of the API key you just created.
        Under "Application restrictions," select the type of restriction that applies to your application (e.g., "HTTP referrers" for web applications, providing your website's domain).
        Under "API restrictions," select "Restrict key" and then choose the specific Google Maps Platform APIs that your application needs to access.
        Click "Save." 





By following these steps, you'll obtain your Google Maps API Key and configure it securely for your application. 
## Features Implemented

1.  **Google Sign-In**:
    *   Users can sign in with their Google account.
    *   If the email exists, they are logged in.
    *   If not, a new account is created automatically.
    *   Checks for `profile_incomplete` status.

2.  **Profile Completion**:
    *   If a user's profile is missing required fields (Date of Birth), they are redirected to `/complete-profile`.
    *   **Google Places Autocomplete**: Users can search for their city.
    *   **Geolocation**: Latitude/Longitude is automatically fetched from the selected place.

## Troubleshooting

*   **Error: "Google configuration missing"**: Check backend `.env` variables.
*   **Error: "Google authentication failed"**: Check if the Authorization Code flow is enabled and `postmessage` is allowed as a redirect URI in Google Console.
*   **Map/Autocomplete not working**: Check browser console for Google Maps API errors (often invalid key or missing API enablement).
