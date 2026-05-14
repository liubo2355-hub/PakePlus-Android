# 党的知识刷题模拟系统

本目录是从《党的知识八百问 （2025年5月修订）》抽取生成的本地刷题网页。

## 启动

在当前目录运行：

```powershell
& 'C:\Users\Ivan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

然后打开：

```text
http://localhost:8018/
```

## 功能

- 练习模式：不限题量，可选择全部题型或单项选择、多项选择、判断、填空。
- 模拟考试：每次随机 50 题，每题 2 分，交卷后显示总分。
- 答题卡：桌面端在右侧显示，手机端折叠到底部按钮。
- 错题回看：交卷后可以回看本次错题和正确答案。

## 题库

题库文件为 `questions.json`，当前共 799 题：

- 单项选择题：291 题
- 多项选择题：172 题
- 判断题：215 题
- 填空题：121 题
