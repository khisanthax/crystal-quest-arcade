# Catalog artwork

The owner dashboard can create collectible badges from its built-in icon set. Badge names, descriptions and rarity are stored in the cloud catalog. Retiring a badge stops new grants while retaining it in existing collections.

Add a new 3D accessory or species through a source branch:

1. Choose a stable ID and define the catalog entry. Use `dist/runner/collection.js` for accessory slots and `dist/runner/pet-catalog.js` for species. Retain old IDs so stored purchases keep working.
2. Add original art to the existing modular renderer in `dist/runner/pet-art.js` or `dist/runner/expanded-pet-art.js`. Use the existing anatomy, movement and accessory attachment points. Keep the small card preview and the equipped model consistent.
3. Verify the new item in the shop, inventory and live run. Exercise an old save and a new purchase against the backend. Check at iPad landscape sizes and confirm only the equipped companion is present in a run.
4. Record rights and attribution for any imported asset. Review size and rendering cost before adding it to the build.
