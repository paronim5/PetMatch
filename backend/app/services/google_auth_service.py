from oauthlib.oauth2 import WebApplicationClient
import requests
import json
import os
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Allow insecure transport for local development
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

class GoogleAuthService:
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI
        self.discovery_url = "https://accounts.google.com/.well-known/openid-configuration"
        self.client = WebApplicationClient(self.client_id)

    def get_google_provider_cfg(self):
        try:
            return requests.get(self.discovery_url).json()
        except Exception as e:
            logger.error(f"Error fetching Google provider config: {e}")
            return None

    def get_login_url(self):
        google_provider_cfg = self.get_google_provider_cfg()
        if not google_provider_cfg:
            return None
            
        authorization_endpoint = google_provider_cfg["authorization_endpoint"]
        
        request_uri = self.client.prepare_request_uri(
            authorization_endpoint,
            redirect_uri=self.redirect_uri,
            scope=["openid", "email", "profile"],
        )
        return request_uri

    def get_token(self, code: str):
        google_provider_cfg = self.get_google_provider_cfg()
        token_endpoint = google_provider_cfg["token_endpoint"]
        
        # Prepare the token request
        token_url, headers, body = self.client.prepare_token_request(
            token_endpoint,
            authorization_response=f"{self.redirect_uri}?code={code}",
            redirect_url=self.redirect_uri,
            code=code
        )
        
        # Send the request
        token_response = requests.post(
            token_url,
            headers=headers,
            data=body,
            auth=(self.client_id, self.client_secret),
        )
        
        # Parse the response
        return self.client.parse_request_body_response(json.dumps(token_response.json()))
    
    def get_user_info(self, token_response):
        google_provider_cfg = self.get_google_provider_cfg()
        userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
        
        uri, headers, body = self.client.add_token(userinfo_endpoint)
        userinfo_response = requests.get(uri, headers=headers, data=body)
        
        user_info = userinfo_response.json()
        if user_info.get("email_verified"):
            return user_info
        return None

google_auth_service = GoogleAuthService()
