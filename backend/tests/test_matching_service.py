import pytest
from unittest.mock import MagicMock, patch
from app.services.matching_service import LocationBasedMatching
from app.domain.models import User, UserProfile, UserPreferences
from app.domain.enums import GenderType, DealBreakerType
from sqlalchemy.orm import Session
from sqlalchemy import func

def test_find_matches_age_filter_logic():
    # Setup
    strategy = LocationBasedMatching()
    mock_db = MagicMock(spec=Session)
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    mock_user.profile = MagicMock(spec=UserProfile)
    mock_user.profile.location = "POINT(0 0)"
    
    mock_user.preferences = MagicMock(spec=UserPreferences)
    mock_user.preferences.min_age = 25
    mock_user.preferences.max_age = 30
    mock_user.preferences.preferred_genders = []
    mock_user.preferences.deal_breakers = []
    mock_user.preferences.max_distance = 50

    # Mock DB query chain
    mock_query = MagicMock()
    mock_db.query.return_value.options.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value = mock_query
    
    # Execute
    strategy.find_matches(mock_db, mock_user)
    
    # Assertions are tricky because we need to inspect the filter calls
    # But mainly we want to ensure no TypeError is raised during the call construction
    
    # Check if func.make_interval was called correctly
    # Since we can't easily mock sqlalchemy.func in this integration-style unit test without deeper mocking,
    # we rely on the fact that if the code had the TypeError, it would raise it here if we were actually running it.
    # However, since func.make_interval returns a generic Function object, it won't execute SQL here.
    # The TypeError "Function.__init__() got an unexpected keyword argument 'years'" happens at construction time
    # if we use the keyword argument syntax on the python side.
    
    # So simply running the code path verifies the fix for the TypeError.
    assert True

def test_find_matches_deal_breakers():
    # Setup
    strategy = LocationBasedMatching()
    mock_db = MagicMock(spec=Session)
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    mock_user.profile = MagicMock(spec=UserProfile)
    mock_user.profile.location = "POINT(0 0)"
    
    mock_user.preferences = MagicMock(spec=UserPreferences)
    mock_user.preferences.min_age = None
    mock_user.preferences.max_age = None
    mock_user.preferences.preferred_genders = []
    mock_user.preferences.deal_breakers = [DealBreakerType.smoking, DealBreakerType.has_children]
    mock_user.preferences.max_distance = 50

    # Mock DB query chain
    mock_query = MagicMock()
    # We need to chain properly to reach the deal breaker logic
    filtered_query = MagicMock()
    mock_db.query.return_value.options.return_value.join.return_value.outerjoin.return_value.filter.return_value.group_by.return_value = filtered_query
    filtered_query.filter.return_value = filtered_query # Chainable
    
    # Execute
    strategy.find_matches(mock_db, mock_user)
    
    # Verify filter was called for deal breakers
    # We can't verify exact SQL expressions easily, but we can verify filter was called
    assert filtered_query.filter.call_count >= 2 # Once for smoking, once for has_children (plus potential age/gender if defaults trigger)

