const t = require('@babel/types');

function isImportMetaEnvMember(node) {
  return Boolean(
    node &&
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object &&
    node.object.type === 'MetaProperty' &&
    node.object.meta.name === 'import' &&
    node.object.property.name === 'meta' &&
    node.property &&
    node.property.type === 'Identifier' &&
    node.property.name === 'env'
  );
}

module.exports = function importMetaEnvTransform() {
  return {
    name: 'transform-import-meta-env',
    visitor: {
      MemberExpression(path) {
        const node = path.node;

        if (!isImportMetaEnvMember(node.object)) {
          return;
        }

        if (!node.property || node.property.type !== 'Identifier') {
          return;
        }

        path.replaceWith(
          t.memberExpression(
            t.memberExpression(t.identifier('process'), t.identifier('env')),
            t.identifier(node.property.name)
          )
        );
      },
    },
  };
};