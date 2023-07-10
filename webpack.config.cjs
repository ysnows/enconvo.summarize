const path = require("path")
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    mode: "production",
    target: 'node',
    entry: "./src/index.js", // 入口
    externals: ["canvas","bufferutil","utf-8-validate"],
    output: {
        path: path.join(__dirname, "dist"), // 出口路径
        filename: "main.js" // 出口文件名
    },
    optimization: {
        sideEffects: false,
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "main.yml", to: "main.yml" },
            ],
        }),
    ],
}
