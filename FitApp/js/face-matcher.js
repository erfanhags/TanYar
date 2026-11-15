(function (root) {
  'use strict';
  const MODEL = 'dlib-hog-128-v1';
  const TOLERANCE = 0.5;
  const MARGIN = 0.05;
  const valid = v => Array.isArray(v) && v.length === 128 && v.every(Number.isFinite);
  const distance = (a, b) => Math.sqrt(a.reduce((sum, n, i) => sum + (n - b[i]) ** 2, 0));

  function matchFace(descriptor, users) {
    if (!valid(descriptor)) return null;
    const matches = users
      .filter(u => u.faceLogin?.model === MODEL && valid(u.faceLogin.descriptor))
      .map(u => ({ username: u.username, distance: distance(descriptor, u.faceLogin.descriptor) }))
      .sort((a, b) => a.distance - b.distance);
    if (!matches.length || matches[0].distance > TOLERANCE) return null;
    if (matches[1] && matches[1].distance - matches[0].distance < MARGIN) return null;
    return matches[0].username;
  }

  function enrollSamples(samples) {
    if (samples.length < 3 || samples.length > 5 || !samples.every(valid)) return null;
    for (let i = 0; i < samples.length; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        if (distance(samples[i], samples[j]) > TOLERANCE) return null;
      }
    }
    return {
      model: MODEL,
      descriptor: samples[0].map((_, i) => samples.reduce((sum, sample) => sum + sample[i], 0) / samples.length),
      registeredAt: new Date().toISOString()
    };
  }

  function createTracker() {
    let previous = null;
    let count = 0;
    return {
      push(username) {
        count = username ? (username === previous ? count + 1 : 1) : 0;
        previous = username;
        return count >= 3;
      },
      get count() { return count; }
    };
  }

  const api = { MODEL, matchFace, enrollSamples, createTracker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FIT_FACE_MATCHER = api;
})(typeof window !== 'undefined' ? window : this);
