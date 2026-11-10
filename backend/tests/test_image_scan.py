import asyncio
import io
import os
import sys
from unittest.mock import patch, AsyncMock, MagicMock
import pytest
import httpx
from PIL import Image
from google.genai import errors

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import app
from app.models.user import User
from app.models.meal import Meal, FoodItem
from app.middleware.auth import get_current_user
from app.services.gemini_service import analyze_food, optimize_image_for_analysis, _parse_json_from_text, extract_raw_image_bytes
from app.config import get_settings


@pytest.fixture(autouse=True)
def reset_limiter_and_overrides():
    if hasattr(app.state, "limiter"):
        app.state.limiter.reset()
    app.dependency_overrides.clear()
    yield
    if hasattr(app.state, "limiter"):
        app.state.limiter.reset()
    app.dependency_overrides.clear()


@pytest.fixture
def mock_user():
    return User(id=1, email="test@example.com", phone="+1234567890", name="Test User")


class TestImageScanTimeoutAndOptimization:
    def test_optimize_image_downscales_oversized(self):
        """Verify optimize_image_for_analysis resizes dimensions exceeding max_dim."""
        img = Image.new("RGB", (3000, 2000), color=(200, 100, 50))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        raw = buf.getvalue()

        optimized, mime = optimize_image_for_analysis(raw, original_mime="image/jpeg", max_dim=1280)
        assert mime == "image/jpeg"
        assert len(optimized) < len(raw)

        with Image.open(io.BytesIO(optimized)) as out_img:
            w, h = out_img.size
            assert max(w, h) <= 1280

    def test_optimize_image_passthrough_small(self):
        """Verify optimize_image_for_analysis passes small images through unmodified."""
        img = Image.new("RGB", (200, 200), color=(100, 100, 100))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        raw = buf.getvalue()

        optimized, mime = optimize_image_for_analysis(raw, original_mime="image/png", max_dim=1280)
        assert mime == "image/png"
        assert optimized == raw

    def test_optimize_image_handles_corrupt_data(self):
        """Verify optimize_image_for_analysis gracefully returns original bytes if Pillow fails."""
        corrupt_bytes = b"not_an_actual_image_payload"
        res_bytes, res_mime = optimize_image_for_analysis(corrupt_bytes, original_mime="image/jpeg")
        assert res_bytes == corrupt_bytes
        assert res_mime == "image/jpeg"

    def test_optimize_image_transposes_exif_orientation(self):
        """Verify optimize_image_for_analysis respects EXIF orientation tag 6 (rotate 90 CW)."""
        img = Image.new("RGB", (1000, 2000), color=(255, 128, 0))
        exif = img.getexif()
        exif[0x0112] = 6  # 90 degrees CW
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif)
        raw = buf.getvalue()

        optimized, mime = optimize_image_for_analysis(raw)
        assert mime == "image/jpeg"
        with Image.open(io.BytesIO(optimized)) as out_img:
            # Orientation rotated 90 CW -> landscape (1280, 640)
            assert out_img.width > out_img.height
            assert out_img.width <= 1280

    def test_optimize_image_handles_transparent_rgba(self):
        """Verify optimize_image_for_analysis composites RGBA transparency on a clean white background."""
        img = Image.new("RGBA", (1400, 1400), (0, 0, 0, 0))
        # Draw red box
        for x in range(400, 800):
            for y in range(400, 800):
                img.putpixel((x, y), (255, 0, 0, 255))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        raw = buf.getvalue()

        optimized, mime = optimize_image_for_analysis(raw, original_mime="image/png")
        assert mime == "image/jpeg"
        with Image.open(io.BytesIO(optimized)) as out_img:
            # Corner was transparent -> should be white (255, 255, 255)
            corner_pixel = out_img.getpixel((10, 10))
            assert corner_pixel == (255, 255, 255)

    @pytest.mark.asyncio
    async def test_analyze_food_uses_configured_timeout(self):
        """Verify analyze_food respects settings.GEMINI_TIMEOUT_SECONDS instead of hardcoded 10s."""
        mock_response = MagicMock()
        mock_response.text = '{"items": [{"name": "Apple", "calories": 95, "protein": 0.5, "carbs": 25.0, "fat": 0.3}], "total_calories": 95, "total_protein": 0.5, "total_carbs": 25.0, "total_fat": 0.3}'

        with patch("app.services.gemini_service.get_settings") as mock_get_settings, \
             patch("google.genai.Client") as mock_client_cls, \
             patch("asyncio.wait_for", wraps=asyncio.wait_for) as mock_wait_for:

            settings = mock_get_settings.return_value
            settings.GEMINI_API_KEY = "test_key"
            settings.GEMINI_MODEL = "gemini-2.0-flash"
            settings.GEMINI_TIMEOUT_SECONDS = 35.0

            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

            res = await analyze_food(raw_input="1 apple")
            assert res["total_calories"] == 95
            assert len(res["items"]) == 1

            # Verify asyncio.wait_for was called with the configured timeout (35.0s, not 10.0s)
            mock_wait_for.assert_called_once()
            _, kwargs = mock_wait_for.call_args
            assert kwargs.get("timeout") == 35.0

    def test_optimize_image_transposes_exif_orientation_medium_sized(self):
        """Verify optimize_image_for_analysis transposes EXIF orientation even on images <= max_dim (e.g. 600x800)."""
        img = Image.new("RGB", (600, 800), color=(255, 128, 0))
        exif = img.getexif()
        exif[0x0112] = 6  # 90 degrees CW
        buf = io.BytesIO()
        img.save(buf, format="JPEG", exif=exif)
        raw = buf.getvalue()

        optimized, mime = optimize_image_for_analysis(raw)
        assert mime == "image/jpeg"
        with Image.open(io.BytesIO(optimized)) as out_img:
            # (600, 800) transposed with orientation 6 -> landscape (800, 600)
            assert out_img.size == (800, 600)

    def test_optimize_image_handles_transparent_rgba_medium_sized(self):
        """Verify optimize_image_for_analysis composites RGBA transparency on clean white even on images <= max_dim (e.g. 400x400)."""
        img = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        raw = buf.getvalue()

        optimized, mime = optimize_image_for_analysis(raw, original_mime="image/png")
        assert mime == "image/jpeg"
        with Image.open(io.BytesIO(optimized)) as out_img:
            corner_pixel = out_img.getpixel((10, 10))
            assert corner_pixel == (255, 255, 255)

    def test_parse_json_from_text_empty_input_raises_valueerror(self):
        """Verify _parse_json_from_text rejects empty/none responses with ValueError."""
        with pytest.raises(ValueError, match="AI returned an empty response"):
            _parse_json_from_text("")
        with pytest.raises(ValueError, match="AI returned an empty response"):
            _parse_json_from_text(None)

    @pytest.mark.asyncio
    async def test_analyze_food_handles_httpx_timeout(self):
        """Verify analyze_food catches httpx.ReadTimeout and raises service TimeoutError."""
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content.side_effect = httpx.ReadTimeout("HTTP connection read timeout")

            with pytest.raises(TimeoutError) as exc_info:
                await analyze_food(raw_input="food")
            assert "AI food scanning service timed out" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_analyze_food_handles_apierror_deadline_exceeded(self):
        """Verify analyze_food catches upstream DEADLINE_EXCEEDED APIError and raises TimeoutError."""
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = mock_client_cls.return_value
            api_err = errors.APIError(504, {"error": {"message": "Deadline exceeded", "status": "DEADLINE_EXCEEDED"}})
            mock_client.aio.models.generate_content.side_effect = api_err

            with pytest.raises(TimeoutError) as exc_info:
                await analyze_food(raw_input="food")
            assert "AI food scanning service timed out" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_analyze_food_handles_null_calories_and_string_values(self):
        """Verify analyze_food safely defaults null calorie values and parses numeric strings."""
        mock_response = MagicMock()
        mock_response.text = '{"items": [{"name": "Diet Water", "calories": null, "protein": null, "carbs": "0.0", "fat": "0.0"}], "total_calories": null}'

        with patch("app.services.gemini_service.get_settings") as mock_get_settings, \
             patch("google.genai.Client") as mock_client_cls:
            settings = mock_get_settings.return_value
            settings.GEMINI_API_KEY = "test_key"
            settings.GEMINI_MODEL = "gemini-2.0-flash"
            settings.GEMINI_TIMEOUT_SECONDS = 35.0

            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

            res = await analyze_food(raw_input="diet water")
            assert res["total_calories"] == 0
            assert res["items"][0]["calories"] == 0
            assert res["items"][0]["protein"] == 0.0

    def test_parse_json_from_text_handles_trailing_commas(self):
        """Verify _parse_json_from_text tolerates trailing commas emitted by LLMs."""
        text = '{"items": [{"name": "Roti", "calories": 80, }, ], "total_calories": 80, }'
        parsed = _parse_json_from_text(text)
        assert parsed["total_calories"] == 80
        assert len(parsed["items"]) == 1
        assert parsed["items"][0]["name"] == "Roti"

    def test_parse_json_from_text_handles_json_array(self):
        """Verify _parse_json_from_text wraps top-level arrays into items dict."""
        text = '[{"name": "Paneer", "calories": 250}, {"name": "Dal", "calories": 150}]'
        parsed = _parse_json_from_text(text)
        assert len(parsed["items"]) == 2
        assert parsed["items"][0]["name"] == "Paneer"

    @pytest.mark.asyncio
    async def test_analyze_food_handles_null_items_and_non_dicts(self):
        """Verify analyze_food does not crash if items is null or contains non-dict elements."""
        mock_response = MagicMock()
        mock_response.text = '{"items": null, "total_calories": 0}'

        with patch("app.services.gemini_service.get_settings") as mock_get_settings, \
             patch("google.genai.Client") as mock_client_cls:
            settings = mock_get_settings.return_value
            settings.GEMINI_API_KEY = "test_key"
            settings.GEMINI_MODEL = "gemini-2.0-flash"
            settings.GEMINI_TIMEOUT_SECONDS = 35.0

            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

            res = await analyze_food(raw_input="food")
            assert res["items"] == []
            assert res["total_calories"] == 0

        # Also verify items containing non-dict elements (e.g. strings or None)
        mock_response_strings = MagicMock()
        mock_response_strings.text = '{"items": ["apple", null, {"name": "Banana", "calories": 105}]}'
        with patch("app.services.gemini_service.get_settings") as mock_get_settings, \
             patch("google.genai.Client") as mock_client_cls:
            settings = mock_get_settings.return_value
            settings.GEMINI_API_KEY = "test_key"
            settings.GEMINI_MODEL = "gemini-2.0-flash"
            settings.GEMINI_TIMEOUT_SECONDS = 35.0

            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response_strings)

            res2 = await analyze_food(raw_input="food")
            assert len(res2["items"]) == 1
            assert res2["items"][0]["name"] == "Banana"
            assert res2["total_calories"] == 105

    @pytest.mark.asyncio
    async def test_analyze_food_defaults_missing_item_name(self):
        """Verify analyze_food defaults missing item name to 'Food item'."""
        mock_response = MagicMock()
        mock_response.text = '{"items": [{"calories": 120, "protein": 6.0}], "total_calories": 120}'

        with patch("app.services.gemini_service.get_settings") as mock_get_settings, \
             patch("google.genai.Client") as mock_client_cls:
            settings = mock_get_settings.return_value
            settings.GEMINI_API_KEY = "test_key"
            settings.GEMINI_MODEL = "gemini-2.0-flash"
            settings.GEMINI_TIMEOUT_SECONDS = 35.0

            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

            res = await analyze_food(raw_input="food")
            assert res["items"][0]["name"] == "Food item"
            assert res["items"][0]["calories"] == 120

    def test_extract_raw_image_bytes_decodes_gif_base64(self):
        """Verify extract_raw_image_bytes recognizes and decodes GIF base64 byte string."""
        gif_b64 = b"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        raw = extract_raw_image_bytes(gif_b64)
        assert raw.startswith(b"GIF89a")

    @pytest.mark.asyncio
    async def test_analyze_food_whitespace_image_does_not_append_empty_part(self):
        """Verify analyze_food does not append empty Part if image_bytes is only whitespace."""
        mock_response = MagicMock()
        mock_response.text = '{"items": [], "total_calories": 0}'

        with patch("app.services.gemini_service.get_settings") as mock_get_settings, \
             patch("google.genai.Client") as mock_client_cls:
            settings = mock_get_settings.return_value
            settings.GEMINI_API_KEY = "test_key"
            settings.GEMINI_MODEL = "gemini-2.0-flash"
            settings.GEMINI_TIMEOUT_SECONDS = 35.0

            mock_client = mock_client_cls.return_value
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

            await analyze_food(raw_input="test meal", image_bytes=b"   ")
            _, kwargs = mock_client.aio.models.generate_content.call_args
            contents = kwargs.get("contents", [])
            # Only prompt_text should be in contents, no empty image Part
            assert len(contents) == 1
            assert contents[0] == "test meal"


class TestImageScanEndpoints:
    @pytest.mark.asyncio
    async def test_scan_image_base64_success(self, mock_user):
        """Verify POST /api/meals/scan-image-base64 succeeds with 201."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        dummy_b64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        payload = {
            "photo_base64": dummy_b64,
            "raw_input": "Scanned lunch",
            "meal_type": "lunch",
            "meal_date": "2026-11-04"
        }

        mock_created_meal = {
            "id": 42,
            "meal_type": "lunch",
            "raw_input": "Scanned lunch",
            "total_calories": 520,
            "total_protein": 32.0,
            "total_carbs": 60.0,
            "total_fat": 15.0,
            "image_url": None,
            "meal_date": "2026-11-04",
            "logged_at": "2026-11-04T12:00:00",
            "food_items": [
                {
                    "id": 1,
                    "name": "Grilled Chicken",
                    "quantity": 1.0,
                    "unit": "serving",
                    "calories": 300,
                    "protein": 28.0,
                    "carbs": 0.0,
                    "fat": 5.0,
                }
            ],
        }

        with patch("app.routers.meals.create_meal", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_created_meal
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post("/api/meals/scan-image-base64", json=payload)
                assert resp.status_code == 201
                data = resp.json()
                assert data["id"] == 42
                assert data["total_calories"] == 520
                assert data["meal_type"] == "lunch"

    @pytest.mark.asyncio
    async def test_scan_image_base64_timeout_returns_504(self, mock_user):
        """Verify POST /api/meals/scan-image-base64 returns 504 on service timeout."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        dummy_b64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        payload = {"photo_base64": dummy_b64, "meal_type": "lunch"}

        with patch("app.routers.meals.create_meal", side_effect=TimeoutError("AI food scanning service timed out after 35.0s")):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post("/api/meals/scan-image-base64", json=payload)
                assert resp.status_code == 504
                data = resp.json()
                assert data["detail"] == "AI food scanning service timed out. Please enter meal details manually."
                assert data["error_code"] == "AI_SERVICE_UNAVAILABLE"
                assert data["fallback_to_manual"] is True

    @pytest.mark.asyncio
    async def test_scan_image_multipart_success(self, mock_user):
        """Verify POST /api/meals/scan-image (multipart) succeeds with 201."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        dummy_img = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82"

        mock_created_meal = {
            "id": 99,
            "meal_type": "dinner",
            "raw_input": "Scanned dinner photo",
            "total_calories": 450,
            "total_protein": 25.0,
            "total_carbs": 40.0,
            "total_fat": 12.0,
            "image_url": "https://storage.example.com/meal.jpg",
            "meal_date": "2026-11-04",
            "logged_at": "2026-11-04T19:00:00",
            "food_items": [],
        }

        with patch("app.routers.meals.create_meal", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_created_meal
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post(
                    "/api/meals/scan-image",
                    files={"image": ("test.png", dummy_img, "image/png")},
                    data={"meal_type": "dinner", "raw_input": "Scanned dinner photo", "image_url": "https://storage.example.com/meal.jpg"},
                )
                assert resp.status_code == 201
                data = resp.json()
                assert data["id"] == 99
                assert data["total_calories"] == 450

    @pytest.mark.asyncio
    async def test_scan_image_multipart_timeout_returns_504(self, mock_user):
        """Verify POST /api/meals/scan-image (multipart) returns 504 on timeout."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        dummy_img = b"fake_png_data"

        with patch("app.routers.meals.create_meal", side_effect=TimeoutError("AI food scanning service timed out after 35.0s")):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post(
                    "/api/meals/scan-image",
                    files={"image": ("test.png", dummy_img, "image/png")},
                    data={"meal_type": "dinner"},
                )
                assert resp.status_code == 504
                data = resp.json()
                assert data["detail"] == "AI food scanning service timed out. Please enter meal details manually."
                assert data["error_code"] == "AI_SERVICE_UNAVAILABLE"

    @pytest.mark.asyncio
    async def test_scan_image_invalid_base64_returns_422(self, mock_user):
        """Verify POST /api/meals/scan-image-base64 rejects corrupted base64."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        payload = {"photo_base64": "!!!NOT_VALID_BASE64!!!", "meal_type": "lunch"}
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.post("/api/meals/scan-image-base64", json=payload)
            assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_scan_image_multipart_httpx_timeout_returns_504(self, mock_user):
        """Verify POST /api/meals/scan-image returns 504 on httpx.ReadTimeout."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        dummy_img = b"fake_png_data"
        with patch("app.routers.meals.create_meal", side_effect=httpx.ReadTimeout("Socket read timed out")):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post(
                    "/api/meals/scan-image",
                    files={"image": ("test.png", dummy_img, "image/png")},
                    data={"meal_type": "dinner"},
                )
                assert resp.status_code == 504
                data = resp.json()
                assert data["detail"] == "AI food scanning service timed out. Please enter meal details manually."
                assert data["error_code"] == "AI_SERVICE_UNAVAILABLE"

    @pytest.mark.asyncio
    async def test_scan_image_base64_httpx_timeout_returns_504(self, mock_user):
        """Verify POST /api/meals/scan-image-base64 returns 504 on httpx.ReadTimeout."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        dummy_b64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        payload = {"photo_base64": dummy_b64, "meal_type": "lunch"}

        with patch("app.routers.meals.create_meal", side_effect=httpx.ReadTimeout("Socket read timed out")):
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post("/api/meals/scan-image-base64", json=payload)
                assert resp.status_code == 504
                data = resp.json()
                assert data["detail"] == "AI food scanning service timed out. Please enter meal details manually."
                assert data["error_code"] == "AI_SERVICE_UNAVAILABLE"

    @pytest.mark.asyncio
    async def test_scan_image_base64_unpadded_succeeds(self, mock_user):
        """Verify POST /api/meals/scan-image-base64 succeeds when base64 is missing trailing '=' padding."""
        app.dependency_overrides[get_current_user] = lambda: mock_user

        # Base64 string for 1x1 GIF with trailing == stripped
        unpadded_b64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRA"
        payload = {
            "photo_base64": unpadded_b64,
            "raw_input": "Scanned lunch",
            "meal_type": "lunch",
            "meal_date": "2026-11-04"
        }

        mock_created_meal = {
            "id": 105,
            "meal_type": "lunch",
            "raw_input": "Scanned lunch",
            "total_calories": 300,
            "total_protein": 20.0,
            "total_carbs": 40.0,
            "total_fat": 5.0,
            "image_url": None,
            "meal_date": "2026-11-04",
            "logged_at": "2026-11-04T12:00:00",
            "food_items": [],
        }

        with patch("app.routers.meals.create_meal", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_created_meal
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                resp = await client.post("/api/meals/scan-image-base64", json=payload)
                assert resp.status_code == 201
                data = resp.json()
                assert data["id"] == 105
                assert data["total_calories"] == 300
