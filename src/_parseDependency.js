import _resolveNameArg from "./_resolveNameArg";
import { parse } from "@babel/parser";

export default (plugin, t, dep, metadata, buildAmdArg, buildBrowserArg, buildCommonJsArg, _resolveName, opts) => {
  if (opts.resolve && opts.resolve[dep]) {
    dep = opts.resolve[dep];
  }

  if (!dep.startsWith("%{")) {
    return false;
  }

  if (dep[dep.length - 1] !== "}") {
    throw plugin.file.buildCodeFrameError(metadata, `Expecting import to end with "}" but got "${ dep[dep.length - 1] }"`, SyntaxError);
  }

  let program;
  try {
    program = parse(`(${ dep.slice(1) })`).program;
  } catch (err) {
    throw plugin.file.buildCodeFrameError(metadata, err.message, SyntaxError);
  }

  if (metadata.loc) {
    const index = 1;
    // const start = metadata.loc.start + index;

    // Object.assign(program, {
    //   start: start + program.start,
    //   end: start + program.end
    // });

    program.loc.start.line += metadata.loc.start.line - 1;
    program.loc.start.column += metadata.loc.start.column + 1 + index; // +1 to be after quote('"')
    program.loc.end.line += metadata.loc.start.line - 1;
    program.loc.end.column += metadata.loc.start.column + 1 + index; // +1 to be after quote('"')
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
        buildAmdArg(arg);
        break;
      case "browser":
        buildBrowserArg(arg);
        break;
      case "brunch":
        if (seen[name]) {
          buildCommonJsArg("brunch", false);
        }
        buildCommonJsArg(name, arg);
        break;
      case "common":
        buildCommonJsArg(name, arg);
        if (seen.brunch === undefined) {
          buildCommonJsArg("brunch", arg);
          seen.brunch = 1;
        }
        break;
      case "node":
        buildCommonJsArg(name, arg);
        break;
      default:
        throw plugin.file.buildCodeFrameError(program, `Unknown environment ${ name }'`, SyntaxError);
    }

    seen[name] = 1;
  });

  if (!seen.amd) {
    buildAmdArg(t.identifier("undefined"));
  }
  if (!seen.browser) {
    buildBrowserArg(t.identifier("undefined"));
  }
  if (!seen.brunch) {
    buildCommonJsArg("brunch", t.identifier("undefined"));
  }
  if (!seen.common) {
    buildCommonJsArg("common", t.identifier("undefined"));
  }
  if (!seen.node) {
    buildCommonJsArg("node", t.identifier("undefined"));
  }

  return true;
};
