// this function will also be used in transformed file
// and to make it compliant with minifiers/browsers it has to be ES3 compliant
export default function resolveName(dep) {
  // eslint-disable-next-line prefer-arrow-callback
  return dep.replace(/(?:(?:\\(.))|(\/\*{1,2})$)/g, function(match, _escape, pack) {
    if (_escape) {
      return _escape;
    }

    if (pack === "/*") {
      return "/package";
    }

    return "/deepack";
  });
}
