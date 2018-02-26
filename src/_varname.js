import { basename, extname } from "path";
import _parseDependency from "./_parseDependency";

export default (plugin, t, node, _resolveName) => {
  let setted = false;
  let name = node.value;

  const setName = arg => {
    if (!setted && arg && arg.value) {
      setted = true;
      name = arg.value;
    }
  };

  const amdArg = setName;
  const browserArg = setName;
  const commonArg = (type, arg) => {
    setName(arg);
  };

  _parseDependency(plugin, t, node, amdArg, browserArg, commonArg, _resolveName);

  if (name[0] === "!") {
    name = name.slice(1);
  }

  return basename(name, extname(name));
};
