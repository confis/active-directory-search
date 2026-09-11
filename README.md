Edit the config.php with your AD credentials
Read and search the values from MS Active Directory in WEB UI  
install xampp + php8 , and let it run.

## Branding / white-label

The look of the app is customizable in one place — **`branding.php`** — so each
deployment can present its own name, logo and colors without touching
`index.php`. Edit the `$brand` array and refresh the page (no build step):

- `name` – organization / app name (browser tab title fallback).
- `title` – browser tab title (leave `''` to fall back to `name`).
- `subtitle` – the heading shown under the logo (leave `''` to hide).
- `logo` / `logo_alt` – path to the logo image (leave `logo` `''` to hide it).
- `primary` – the brand color used for buttons, the table header and paging.
- `primary_dark` – hover/active shade (leave `''` to auto-derive from `primary`).
- `on_primary` – text color placed on top of the brand color.

Semantic colors (green for success, red for errors) stay fixed on purpose.
