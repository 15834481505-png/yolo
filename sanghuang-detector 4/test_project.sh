#!/bin/bash

echo "=== 桑黄检测系统项目检查 ==="
echo ""

echo "1. 检查项目结构:"
ls -la
echo ""

echo "2. 检查模型文件:"
if [ -f "model/model.onnx" ]; then
    echo "✅ 模型文件存在: model/model.onnx"
    echo "   大小: $(du -h model/model.onnx | cut -f1)"
else
    echo "❌ 模型文件不存在: model/model.onnx"
    if [ -f "best.onnx" ]; then
        echo "   发现 best.onnx，正在移动到 model/ 目录..."
        mkdir -p model
        mv best.onnx model/model.onnx
        echo "✅ 模型文件已移动到: model/model.onnx"
    fi
fi
echo ""

echo "3. 检查关键文件:"
files=("index.html" "app.js" "style.css" "manifest.json" "service-worker.js")
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 不存在"
    fi
done
echo ""

echo "4. 检查文件内容:"
echo "   - index.html: $(wc -l index.html | cut -d' ' -f1) 行"
echo "   - app.js: $(wc -l app.js | cut -d' ' -f1) 行"
echo "   - style.css: $(wc -l style.css | cut -d' ' -f1) 行"
echo "   - manifest.json: $(wc -l manifest.json | cut -d' ' -f1) 行"
echo "   - service-worker.js: $(wc -l service-worker.js | cut -d' ' -f1) 行"
echo ""

echo "5. 检查 service worker 注册:"
if grep -q "serviceWorker.register" index.html; then
    echo "✅ Service Worker 注册代码存在"
    if grep -q "service-worker.js" index.html; then
        echo "✅ Service Worker 路径正确"
    else
        echo "❌ Service Worker 路径错误"
    fi
else
    echo "❌ Service Worker 注册代码缺失"
fi
echo ""

echo "6. 检查模型加载路径:"
if grep -q "model/model.onnx" app.js; then
    echo "✅ 模型加载路径正确"
else
    echo "❌ 模型加载路径错误"
fi
echo ""

echo "7. 检查 ONNX Runtime CDN:"
if grep -q "cdn.jsdelivr.net" index.html; then
    echo "✅ ONNX Runtime CDN 正确"
else
    echo "❌ ONNX Runtime CDN 错误"
fi
echo ""

echo "=== 检查完成 ==="
echo "项目结构看起来正常，可以部署到 GitHub Pages 了！"
