// The only hosts Finnie talks to. src-tauri/src/main.rs keeps the same list.
export const ALLOWED_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com", "api.exchange.coinbase.com"];
// Yahoo answers a bare client with 429s; a browser's agent string gets the normal service.
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
