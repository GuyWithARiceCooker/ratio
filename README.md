# Ratio — natív Android kamera

Ez nem a böngészős app. React Native + Expo, a kép a telefon saját kamerafelületéről jön (`react-native-vision-camera`). A fotó a képernyő aktuális arányára van vágva. A jobb oldali sín fókuszt húz.

A 2 GB-os VPS **nem** tudja lefordítani. Az Expo felhője (EAS) igen.

## Amit kapsz

- Natív előnézet, nem `getUserMedia`
- Jobb oldali fókuszsín
- Exponálás a képernyő arányában (cover-vágás)
- Lámpa, lencseváltás, rács
- Mentés a galériába

A sín VisionCamera 4-ben autofókuszt húz a kép egy pontjára (közel = lejjebb, távol = feljebb). A lencse milliméter-pontos rögzítése a VisionCamera 5 `setFocusLocked` hívása lenne; az még kevésbé stabil Expo-build, ezért ez a csomag a 4.7.3-at használja.

## Fordítás az Expo felhőjében

Saját gépen (laptop is jó), Node 20:

```bash
cd ratio-native
npm install
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Az első futásnál az EAS kér egy Android keystore-t. Válaszd a „Generate new keystore” opciót.

A build végén kapsz egy linket. Onnan töltsd le az APK-t, és telepítsd a telefonra (ismeretlen forrás engedélyezése kellhet).

A `preview` profil APK-t ad, nem Play Store csomagot. Telepíthető közvetlenül.

## Ha mégis saját gépen fordítanád

Csak 8 GB RAM felett:

```bash
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleDebug
```

Az APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Amit a telefonon látsz

1. Engedélyezd a kamerát.
2. A jobb sín húzza a fókuszt.
3. A nagy gomb exponál. A kép a képernyő alakja.
4. Mentés a galériába.
