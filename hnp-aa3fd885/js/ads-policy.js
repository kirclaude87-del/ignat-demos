window.Hnp = window.Hnp || {};

// Когда показывать рекламу между уровнями: после каждого INTERSTITIAL_EVERY-го пройденного уровня,
// только с интернетом и никогда сразу после рекламы за жизнь.
Hnp.adsPolicy = Object.freeze({
  shouldShowInterstitial(info) {
    return (
      !!info.online &&
      !info.rewardedSinceLastLevel &&
      info.completedSinceInterstitial >= Hnp.config.INTERSTITIAL_EVERY
    );
  },
});
