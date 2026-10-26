import { Asset } from "expo-asset";
import { Platform, type ImageSourcePropType } from "react-native";

// On web, react-native-web sizes a bundled image to its intrinsic pixel size
// (from the asset metadata), overriding the layout styles. A plain URI source
// lets the frame's own width, height and aspect ratio decide.
const fromModule = (module: number): ImageSourcePropType =>
  Platform.OS === "web" ? { uri: Asset.fromModule(module).uri } : module;

// Rendered from the SVG sources in assets/brand by `npm run brand:assets`.
export const BrandArt = {
  logoMark: fromModule(require("../../assets/brand/logo-mark.png")),
  bannerPlaceholder: fromModule(require("../../assets/brand/banner-placeholder.png")),
  posterPlaceholder: fromModule(require("../../assets/brand/poster-placeholder.png")),
};
