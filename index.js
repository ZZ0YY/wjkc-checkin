/**
 * 网际快车 (wjkc.lol) 自动签到脚本
 *
 * @description 这是一个基于 Node.js 的自动化脚本，设计用于在 GitHub Actions 环境中运行。
 *              它能够每日自动为“网际快车”网站执行签到任务，并推送结果通知。
 *
 * @version 1.1.0
 * @date 2024-07-14
 *
 * 功能:
 * 1. 支持通过 GitHub Secrets 配置多账号。
 * 2. 自动处理服务器返回的 Base64 编码数据。
 * 3. 通过 PushPlus 等渠道发送格式化后的签到报告。
 * 4. 代码结构清晰，包含详细注释。
 */

/**
 * 核心签到函数，为一个账号执行签到操作。
 * @param {string} token - 用户的身份令牌 (从 Cookie 中提取)。
 * @returns {Promise<string>} - 返回包含该账号执行结果的通知字符串。
 */
const runCheckinForAccount = async (token) => {
    const noticeBody = [];

    try {
        // 构造请求头，核心是包含 token 的 Cookie 字符串
        const headers = {
            'Host': 'wjkc.lol',
            'Connection': 'keep-alive',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
            'Origin': 'https://wjkc.lol',
            'Referer': 'https://wjkc.lol/',
            'Cookie': `token=${token}`
        };

        // 固定的请求体, '{"data":"e30="}'，其中 e30= 是空对象 {} 的 Base64 编码
        const payload = JSON.stringify({ data: "e30=" });

        // 使用 fetch API 发送 POST 请求
        const response = await fetch('https://wjkc.lol/api/user/sign_use', {
            method: 'POST',
            headers: headers,
            body: payload,
        });

        // 解析服务器返回的 JSON 数据
        const result = await response.json();

        // 成功的响应包含一个 'data' 字段，其值为 Base64 编码的字符串
        if (result && result.data) {
            // 使用 Buffer 解码 Base64 数据
            const decodedData = Buffer.from(result.data, 'base64').toString('utf-8');
            const checkinResult = JSON.parse(decodedData);

            if (checkinResult.code === 0 && checkinResult.msg === "SUCCESS") {
                const addedTraffic = checkinResult.data.addTraffic || 0;
                const trafficInMB = (addedTraffic / 1024 / 1024).toFixed(0);
                noticeBody.push(`✅ 签到成功: 获得 ${trafficInMB} MB 流量`);
                noticeBody.push(`📅 连续签到: ${checkinResult.data.haveContinueSignUseData} 天`);
            } else {
                const message = checkinResult.msg || '未知成功信息';
                if (message.includes("已经签到")) {
                    noticeBody.push(`✅ 今日已签到`);
                } else {
                    noticeBody.push(`💡 操作完成: ${message}`);
                }
            }
        } else {
            // 如果响应中没有 'data' 字段，通常意味着请求出错（如 Token 失效）
            throw new Error(result.msg || '响应格式无效，可能是 Token 已失效。');
        }
    } catch (error) {
        noticeBody.push(`❌ 签到失败`);
        noticeBody.push(`💬 原因: ${error.message}`);
    }

    return noticeBody.join('\n');
};

/**
 * 通知函数，将签到结果通过不同渠道推送。
 * @param {string} noticeTitle - 通知的标题.
 * @param {string} noticeBody - 通知的主体内容.
 */
const notify = async (noticeTitle, noticeBody) => {
    // 检查 NOTIFY 环境变量是否存在，不存在则不推送
    if (!process.env.NOTIFY || !noticeBody) {
        console.log("未配置通知或无通知内容，跳过推送。");
        return;
    }
    
    // 首先在 Actions 日志中打印完整通知，方便调试
    console.log("--- Notification Preview ---");
    console.log(`Title: ${noticeTitle}`);
    console.log(`Body:\n${noticeBody}`);
    console.log("--- End Notification Preview ---");

    // 支持通过换行来配置多个通知渠道
    for (const option of String(process.env.NOTIFY).split('\n')) {
        if (!option.trim()) continue;

        try {
            if (option.startsWith('pushplus:')) {
                const token = option.split(':')[1];
                if (!token) {
                    console.error("PushPlus 配置格式错误，缺少 Token。");
                    continue;
                }
                const pushplusResponse = await fetch('https://www.pushplus.plus/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: token,
                        title: noticeTitle,
                        content: noticeBody.replace(/\n/g, '<br>'), // PushPlus 在 markdown 模板中用 <br> 换行
                        template: 'markdown',
                    }),
                });
                const pushplusResult = await pushplusResponse.json();
                if (pushplusResult.code === 200) {
                    console.log("PushPlus 通知已成功发送。");
                } else {
                    console.error("PushPlus 通知发送失败:", pushplusResult.msg);
                }
            } 
            // 可以在此处添加 else if 来支持更多通知方式，例如 WxPusher
            // else if (option.startsWith('wxpusher:')) { ... }
            
        } catch (error) {
            console.error(`发送通知到 ${option.split(':')[0]} 失败:`, error);
        }
    }
};


/**
 * 主执行函数 (程序入口)
 */
const main = async () => {
    // 从环境变量中获取 WJKC_TOKEN
    const wjkcTokens = process.env.WJKC_TOKEN;

    if (!wjkcTokens) {
        console.error("错误: 未找到 WJKC_TOKEN 环境变量，请在 GitHub Secrets 中正确设置。");
        process.exit(1); // 退出并标记 Action 运行失败
    }

    // 支持多账号，通过换行符分割
    const tokens = wjkcTokens.split('\n').filter(t => t.trim() !== '');
    if (tokens.length === 0) {
        console.log("WJKC_TOKEN 环境变量为空，无需执行。");
        return;
    }
    
    console.log(`检测到 ${tokens.length} 个账号，开始执行签到...`);

    const allNotices = [];
    let successCount = 0;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        console.log(`\n--- 正在为账号 ${i + 1} 执行签到 ---`);
        const resultMessage = await runCheckinForAccount(token);
        
        // 检查结果是否包含成功或已签到的标志
        if (resultMessage.includes('✅')) {
            successCount++;
        }

        // 为多账号情况添加账号标识
        const accountHeader = tokens.length > 1 ? `[账号 ${i + 1}]` : '';
        allNotices.push(`${accountHeader}\n${resultMessage}`);
        
        // 如果不是最后一个账号，添加一个友好延迟，避免请求过于频繁
        if (i < tokens.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 延迟 2 秒
        }
    }

    console.log("\n所有账号签到执行完毕。");

    // --- 构造最终通知 ---
    const title = `网际快车签到报告 (${successCount}/${tokens.length} 成功)`;
    const body = allNotices.join('\n\n---\n\n');
    
    // 发送最终通知
    await notify(title, body);
};

// 运行主函数
main();
