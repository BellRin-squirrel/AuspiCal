// AuspiCal 認証システム設定
const AUTH_CONFIG = {
  // サーバーサイドAPIのエンドポイントURL
  API_BASE_URL: "https://auspical.bellrin.f5.si/api/",

  // APIアクセスキー
  HTTP_X_ACCESS_KEY: "ucbancmuvmczvlxgycbvuwfasdyowwap",

  // ブラウザでパスキー認証を行うためのWebページURL
  // （クリック時に ?code=XXXX&username=XXXX が自動付与されます）
  WEB_AUTH_PAGE_URL: "https://auspical.bellrin.f5.si/mypage/",
};