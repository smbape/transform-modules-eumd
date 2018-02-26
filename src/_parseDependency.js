import _resolveNameArg from "./_resolveNameArg";

export default (plugin, t, node, amdArg, browserArg, commonArg, _resolveName) => {
  const dep = node.value;

  if (dep[0] !== "%" || dep[1] !== "{" ) {
    return false;
  }

  if (dep[dep.length - 1] !== "}") {
    throw plugin.file.buildCodeFrameError(node, `Expecting import to end with "}" but got "${ dep[dep.length - 1] }"`, SyntaxError);
  }

  const index = node.value.indexOf(dep) + 1;
  const start = node.start + index;

  let program;
  try {
    program = plugin.file.parse(`(${ dep.slice(1) })`).program;
  } catch (err) {
    throw plugin.file.buildCodeFrameError(node, err.message, SyntaxError);
  }

  if (node.loc) {
    Object.assign(program, {
      start: start + program.start,
      end: start + program.end
    });

    program.loc.start.line += node.loc.start.line - 1;
    program.loc.start.column += node.loc.start.column + 1 + index; // +1 to be after quote('"')
    program.loc.end.line += node.loc.start.line - 1;
    program.loc.end.column += node.loc.start.column + 1 + index; // +1 to be after quote('"')
  } else {
    delete program.loc;
  }

  if (program.body[0].type !== "ExpressionStatement") {
    throw plugin.file.buildCodeFrameError(program, "Expecting an expression", SyntaxError);
  }

  const expression = program.body[0].expression;
  if (expression.type !== "ObjectExpression") {
    throw plugin.file.buildCodeFrameError(program, "Expecting an ObjectExpression", SyntaxError);
  }

  const seen = {};

  expression.properties.forEach(({key: {name}, value}) => {
    if (value.type !== "StringLiteral") {
      throw plugin.file.buildCodeFrameError(program, `Expecting property value of "${ name }" to be a StringLiteral but instead got "${ value.type }"`, SyntaxError);
    }

    const arg = t.stringLiteral(_resolveNameArg(_resolveName, value.value));

    switch (name) {
      case "amd":
        amdArg(arg);
        break;
      case "browser":
        browserArg(arg);
        break;
      case "brunch":
        if (seen[name]) {
          commonArg("brunch", false);
        }
        commonArg(name, arg);
        break;
      case "common":
        commonArg(name, arg);
        if (seen.brunch === undefined) {
          commonArg("brunch", arg);
          seen.brunch = 1;
        }
        break;
      case "node":
        commonArg(name, arg);
        break;
      default:
        throw plugin.file.buildCodeFrameError(program, `Unknown environment ${ name }'`, SyntaxError);
    }

    seen[name] = 1;
  });

  if (!seen.amd) {
    amdArg(t.identifier("undefined"));
  }
  if (!seen.browser) {
    browserArg(t.identifier("undefined"));
  }
  if (!seen.brunch) {
    commonArg("brunch", t.identifier("undefined"));
  }
  if (!seen.common) {
    commonArg("common", t.identifier("undefined"));
  }
  if (!seen.node) {
    commonArg("node", t.identifier("undefined"));
  }

  return true;
};
