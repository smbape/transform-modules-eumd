const OPT_NAME = "@eumd";
const INLINE_OPTS_TREG = new RegExp(/\*?\s*/.source + OPT_NAME + /(?:\s+|$)/.source);
const INLINE_OPTS_REG = new RegExp(/\*?\s*/.source + OPT_NAME + /\s+([^\r\n]+)/.source);

export default function _getOpts(path, state) {
  const opts = Object.assign({}, state.opts);

  const file = state.file;
  const comments = file.ast.comments;
  const commentsLen = comments.length;
  let comment, matches, json;

  for (let i = 0; i < commentsLen; i++) {
    comment = comments[i];
    if (!INLINE_OPTS_TREG.test(comment.value)) {
      continue;
    }

    opts.__inline = true;

    matches = INLINE_OPTS_REG.exec(comment.value);
    if (!matches) {
      break;
    }

    json = matches[1];

    try {
      Object.assign(opts, JSON.parse(json), {
        __inline: true
      });
      break;
    } catch ( err ) {
      throw file.buildCodeFrameError(comment, `Invalid options for ${ OPT_NAME } ${ json }`);
    }

    break;
  }

  if (opts.forbiddenReferences) {
    const parentPath = path.isProgram() ? path : path.findParent(path => path.isProgram());
    const references = parentPath.scope.references;
    if (typeof opts.forbiddenReferences === "string") {
      opts.disabled = references[opts.forbiddenReferences];
    } else if (Array.isArray(opts.forbiddenReferences)) {
      opts.disabled = opts.forbiddenReferences.some(ref => references[ref]);
    }
  }

  return opts;
}
