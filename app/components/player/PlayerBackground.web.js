// The animated fBM player background is Android/native only for now (spec decision
// 2026-10-18): the web build keeps the flat player background. This stub keeps the
// import contract so FullScreenPlayer stays platform-agnostic — and keeps expo-gl out
// of the web bundle entirely.
const PlayerBackground = () => null

export default PlayerBackground
