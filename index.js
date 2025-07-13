/**
 * 网际快车 (wjkc.lol) 自动签到脚本 - 优化版
 *
 * @version 1.2.0
 * @date 2024-07-14
 *
 * 功能:
 * 1. 支持通过 GitHub Secrets 配置多账号，并为每个账号设置别名。
 * 2. 自动处理 Base64 编码和解码。
 * 3. 推送详细的、人性化的签到报告到指定渠道。
 * 4. 公开日志中不包含任何敏感或详细信息，只报告执行状态。
 */

/**
 * 核心签到函数，为一个账号执行签到操作。
 * @param {string} token - 用户的身份令牌。
 * @returns {Promise<string>} - 返回包含该账号执行结果的、详细的通知字符串。
 */
const runCheckinForAccount = async (token) => {
    try {
        const headers = {
            'Host': 'wjkc.lol',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
            'Origin': 'https://wjkc.lol',
            'Referer': 'https://wjkc.lol/',
            'Cookie': `token=${token}`
        };

        const payload = JSON.stringify({ data: "e30=" });

        const response = await fetch('https://wjkc.lol/api/user/sign_use', {
            method: 'POST',
            headers: headers,
            body: payload,
        });

        const result = await response.json();

        if (result && result.data) {
            const decodedData = Buffer.from(result.data, 'base64').toString('utf-8');
            const checkinResult = JSON.parse(decodedData);

            if (checkinResult.code === 0 && checkinResult.msg === "SUCCESS") {
                const addedTraffic = checkinResult.data.addTraffic || 0;
                const trafficInMB = (addedTraffic / 1024 / 1024).toFixed(0);
                return `✅ 签到成功: 获得 ${trafficInMB} MB 流量\n📅 连续签到: ${checkinResult.data.haveContinueSignUseData} 天`;
            } else {
                const message = checkinResult.msg || '未知信息';
                if (message.includes("SIGN_USE_MULTY_TIMES")) {
                    return `✅ 今日已签到 (或IP限制)`;
                }
                if (message.includes("CAN_NOT_SIGNUSE")) {
                    return `❌ 操作失败: 账号不符合签到条件`;
                }
                return `💡 操作完成: ${message}`;
            }
        } else {
            throw new Error(result.msg || 'Token 可能已失效');
        }
    } catch (error) {
        return `❌ 执行异常: ${error.message}`;
    }
};

/**
 * 通知函数，将签到结果通过 PushPlus 推送。
 * @param {string} noticeTitle - 通知的标题。
 * @param {string} noticeBody - 通知的主体内容。
 */
const notify = async (noticeTitle, noticeBody) => {
    if (!process.env.NOTIFY || !noticeBody) {
        console.log("跳过推送，因为未配置 NOTIFY 环境变量。");
        return;
    }
    
    // 我们只处理 pushplus
    const pushplusConfig = String(process.env.NOTIFY).split('\n').find(line => line.startsWith('pushplus:'));
    
    if (!pushplusConfig) {
        console.log("未找到 PushPlus 配置，跳过推送。");
        return;
    }

    const token = pushplusConfig.split(':')[1];
    if (!token) {
        console.error("PushPlus 配置格式错误，缺少 Token。");
        return;
    }

    try {
        const response = await fetch('https://www.pushplus.plus/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                title: noticeTitle,
                content: noticeBody.replace(/\n/g, '<br>'),
                template: 'markdown',
            }),
        });
        const result = await response.json();
        if (result.code === 200) {
            console.log("PushPlus 通知已发送。");
        } else {
            console.error("PushPlus 通知发送失败:", result.msg);
        }
    } catch (error) {
        console.error("发送 PushPlus 通知时发生网络错误:", error);
    }
};


/**
 * 主执行函数 (程序入口)
 */
const main = async () => {
    console.log("开始执行签到任务...");

    // 从环境变量中获取配置
    const wjkcConfig = process.env.WJKC_TOKEN;

    if (!wjkcConfig) {
        console.error("错误: 找不到 WJKC_TOKEN 环境变量。请在仓库 Secrets 中配置。");
        process.exit(1); // 退出并标记 Action 失败
    }

    // 支持多账号，通过换行符分割
    const configs = wjkcConfig.split('\n').filter(c => c.trim() !== '');
    if (configs.length === 0) {
        console.log("WJKC_TOKEN 配置为空，任务结束。");
        return;
    }
    
    console.log(`检测到 ${configs.length} 个账号配置。`);

    const allNoticeDetails = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < configs.length; i++) {
        const configLine = configs[i];
        const parts = configLine.split(',').map(p => p.trim());
        const token = parts[0];
        // 允许用户为每个token设置一个别名，方便在通知中识别
        const alias = parts[1] || `账号 ${i + 1}`; 
        
        console.log(`- 正在处理 ${alias}...`);
        
        const resultMessage = await runCheckinForAccount(token);
        
        if (resultMessage.includes('✅')) {
            successCount++;
        } else {
            failCount++;
        }

        allNoticeDetails.push(`[${alias}]\n${resultMessage}`);
        
        // 友好延迟
        if (i < configs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log("所有账号处理完毕。");
    console.log(`执行结果: ${successCount} 成功, ${failCount} 失败/异常。`);

    // --- 构造最终通知 ---
    const title = `网际快车签到报告 (${successCount}/${configs.length} 成功)`;
    const body = allNoticeDetails.join('\n\n---\n\n');
    
    // 发送最终通知
    await notify(title, body);
    
    console.log("任务执行完成。");
};

// 运行主函数
main();
