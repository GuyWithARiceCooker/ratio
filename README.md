# Ratio

Natív Android kamera: a fotó a képernyő aktuális arányára van vágva. Expo + `react-native-vision-camera`. Verzió: 1.0.0.

## Mit tud

- Natív kamerakép, nem böngészős előnézet
- Exponálás a képernyő arányában (cover-vágás)
- Jobb oldali fókuszsín
- Lámpa, lencseváltás, rács
- Mentés a galériába

## Kell hozzá

- Android telefon
- Kameraengedély
- Galériaengedély a mentéshez

## Telepítés

Klónozás:

```bash
git clone https://gitlab.com/tomi1234/ratio.git
cd ratio
npm install
```

APK az Expo felhőjéből (F-Droid / közvetlen telepítés):

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

A `preview` profil APK-t ad. A build linkjéről töltsd le, és telepítsd a telefonra.

## Licenc

MIT. Copyright (c) 2026 GuyWithARiceCooker.
