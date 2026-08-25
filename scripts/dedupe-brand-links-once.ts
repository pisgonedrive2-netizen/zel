import { dedupeBrandLinks } from "../src/lib/social-api/dedupe-brand-links";

async function main() {
  const r = await dedupeBrandLinks();
  console.log(JSON.stringify(r, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
