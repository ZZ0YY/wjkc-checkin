/**
 * 网际快车 (wjkc.lol) 自动化脚本 - 模拟登录版
 *
 * @version 2.0.0
 * @date 2024-07-14
 *
 * 功能:
 * 1. 通过账号密码模拟登录，自动获取/刷新 Token，无需手动抓包。
 * 2. 密码经过 MD5 加密，符合网站安全要求。
 * 3. 自动执行签到任务。
 * 4. 支持多账号配置，并可设置别名。
 * 5. 推送详细的签到报告。
 * 6. 公开日志中不包含任何敏感或详细信息，只报告执行状态。
 */

// 引入 Node.js 内置的加密模块
const crypto = require('crypto');

/**
 * MD5 加密函数
 * @param {string} text - 需要加密的明文.
 * @returns {string} - 32位小写MD5加密字符串.
 */
const md5 = (text) => {
    return crypto.createHash('md5').update(text).digest('hex');
};

/**
 * 模拟登录并获取 Token
 * @param {string} email - 账号
 * @param {string} password - 明文密码
 * @returns {Promise<string>} - 返回获取到的 Token
 */
const getTokenByLogin = async (email, password) => {
    // 1. 密码 MD5 加密
    const hashedPassword = md5(password);

    // 2. 构造登录载荷 (JSON 对象)
    const loginPayload = {
        email: email,
        password: hashedPassword,
    };

    // 3. 将载荷 Base64 编码
    const base64Payload = Buffer.from(JSON.stringify(loginPayload)).toString('base64');
    
    // 4. 构造最终请求体
    const requestBody = JSON.stringify({ data: base64Payload });

    const headers = {
        'Host': 'wjkc.lol',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    };

    const response = await fetch('https://wjkc.lol/api/user/login', {
        method: 'POST',
        headers: headers,
        body: requestBody,
    });

    const result = await response.json();

    if (result && result.data) {
        const decodedData = Buffer.from(result.data, 'base64').toString('utf-8');
        const loginResult = JSON.parse(decodedData);

        if (loginResult.code === 0 && loginResult.data.token) {
            return loginResult.data.token; // 登录成功，返回 token
        } else {
            throw new Error(`登录失败: ${loginResult.msg || '返回了非预期的成功格式'}`);
        }
    } else {
        throw new Error(result.msg || '登录响应格式无效');
    }
};

/**
 * 核心签到函数
 * @param {string} token - 用户的身份令牌。
 * @returns {Promise<string>} - 返回包含该账号执行结果的、详细的通知字符串。
 */
const runCheckinForAccount = async (token) => {
    const headers = {
        'Host': 'wjkc.lol',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
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
        throw new Error(result.msg || '签到响应格式无效');
    }
};

/**
 * 通知函数
 * @param {string} noticeTitle - 通知的标题.
 * @param {string} noticeBody - 通知的主体内容.
 */
const notify = async (noticeTitle, noticeBody) => {
    if (!process.env.NOTIFY || !noticeBody) {
        console.log("跳过推送，因为未配置 NOTIFY 环境变量。");
        return;
    }
    
    console.log("--- Notification Preview ---");
    console.log(`Title: ${noticeTitle}`);
    console.log(`Body:\n${noticeBody}`);
    console.log("--- End Notification Preview ---");

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
    console.log("开始执行模拟登录签到任务...");

    const wjkcConfig = process.env.WJKC_CREDENTIALS;

    if (!wjkcConfig) {
        console.error("错误: 找不到 WJKC_CREDENTIALS 环境变量。请在仓库 Secrets 中配置。");
        process.exit(1);
    }

    const configs = wjkcConfig.split('\n').filter(c => c.trim() !== '');
    if (configs.length === 0) {
        console.log("配置为空，任务结束。");
        return;
    }
    
    console.log(`检测到 ${configs.length} 个账号配置。`);

    const allNoticeDetails = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < configs.length; i++) {
        const configLine = configs[i];
        const parts = configLine.split(',').map(p => p.trim());
        const email = parts[0];
        const password = parts[1];
        const alias = parts[2] || `账号 ${i + 1}`;
        
        console.log(`- 正在处理 ${alias}...`);

        let noticeMessage = '';
        try {
            console.log(`  - 步骤1: 模拟登录...`);
            const token = await getTokenByLogin(email, password);
            console.log(`  - 登录成功，正在执行签到...`);
            
            noticeMessage = await runCheckinForAccount(token);
        } catch (error) {
            noticeMessage = `❌ 登录/签到流程失败: ${error.message}`;
        }
        
        if (noticeMessage.includes('✅')) {
            successCount++;
        } else {
            failCount++;
        }

        allNoticeDetails.push(`[${alias}]\n${noticeMessage}`);
        
        if (i < configs.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    console.log("\n所有账号处理完毕。");
    console.log(`执行结果: ${successCount} 成功, ${failCount} 失败/异常。`);

    const title = `网际快车签到报告 (${successCount}/${configs.length} 成功)`;
    const body = allNoticeDetails.join('\n\n---\n\n');
    
    await notify(title, body);
    
    console.log("任务执行完成。");
};

main();
