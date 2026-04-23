# Brand assets

Drop the two SnowFox logo PNG files into this folder with these exact names:

```
public/brand/
├── snowfox-horizontal.png   # the wide layout (snowflake left, SNOWFOX right)
└── snowfox-stacked.png      # the stacked layout (snowflake above, SNOWFOX below)
```

Then open `src/components/SnowfoxLogo.tsx` and flip this line:

```ts
const useImageAsset = false;   // change to true once the PNGs are in place
```

Until you do, the site renders an inline-SVG approximation of the mark so nothing ever looks broken.

**Tip:** transparent-background PNGs work best, since the header sits on a light snow background and the email templates sit on navy.
