# SETRAM Live

Application React + TypeScript + Tailwind CSS pour visualiser les véhicules SETRAM en temps réel au Mans.

## Fonctionnalités

- Carte interactive sur tuiles OpenStreetMap.
- Positions GTFS-RT VehiclePosition rafraîchies toutes les 10 secondes.
- Arrêts, lignes, couleurs et tracés chargés depuis le GTFS statique SETRAM.
- Filtre par ligne, recherche véhicule/arrêt/ligne, sélection d'un véhicule.
- Frontend uniquement: aucun backend n'est requis grâce aux en-têtes CORS des flux publics.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Sources

- GTFS-RT véhicules: https://proxy.transport.data.gouv.fr/resource/setram-lemans-gtfs-rt-vehicle-position
- Jeu de données SETRAM: https://transport.data.gouv.fr/datasets/gtfs-du-reseau-des-transports-bus-et-tramway-setram-circulant-sur-le-territoire-le-mans-metropole
