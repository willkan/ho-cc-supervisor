/**
 * Super Proxy 配置文件
 * 可以自定义 Supervisor 的行为和消息格式
 */

module.exports = {
    // 注入消息的风格
    injectionStyle: process.env.INJECTION_STYLE || 'marked', // 'marked', 'natural', 'obvious'
    
    // 带标记的询问（明显区分）
    markedInquiries: [
        "[AUTO-CHECK] Can you check why the tests are failing? [/AUTO-CHECK]",
        "[AUTO-CHECK] The tests don't seem to pass, could you investigate? [/AUTO-CHECK]",
        "[AUTO-CHECK] Hmm, something's not working. Can you debug this? [/AUTO-CHECK]",
        "[AUTO-CHECK] 测试好像没通过，能看看是什么问题吗？ [/AUTO-CHECK]",
        "[SUPERVISOR] Tests failed. Please check the errors. [/SUPERVISOR]",
        "[VERIFY-BOT] Automated check failed, need your attention. [/VERIFY-BOT]",
        "🤖 [AUTO] Tests are failing, can you fix them? [AUTO] 🤖",
        "⚠️ [SYSTEM] Verification failed, please investigate. [SYSTEM] ⚠️"
    ],
    
    // 自然的询问（看起来像人类）
    naturalInquiries: [
        "Can you check why the tests are failing?",
        "The tests don't seem to pass, could you investigate?",
        "Hmm, something's not working. Can you debug this?",
        "测试好像没通过，能看看是什么问题吗？",
        "Tests are failing, any idea why?",
        "Could you take a look at the test errors?"
    ],
    
    // 非常明显的询问（开发调试用）
    obviousInquiries: [
        ">>> AUTOMATED SUPERVISOR MESSAGE START <<<\nTests failed. Please check.\n>>> AUTOMATED SUPERVISOR MESSAGE END <<<",
        "=== THIS IS AN AUTOMATED MESSAGE ===\nYour tests are failing.\n=== END OF AUTOMATED MESSAGE ===",
        "*** SUPERVISOR BOT ***\nDetected test failure, need your attention.\n*** END SUPERVISOR BOT ***",
        "!!! AUTO-GENERATED INQUIRY !!!\nPlease fix the failing tests.\n!!! END AUTO-GENERATED INQUIRY !!!"
    ],
    
    // 触发验证的关键词
    completionKeywords: [
        'done', 'complete', 'finished',
        '完成', '搞定', 'ready',
        'fixed', 'solved', 'implemented'
    ],
    
    // 忽略的关键词（避免误触发）
    ignoreKeywords: [
        'not done', 'not complete', 'not finished',
        'will be done', 'to be done', 'getting done',
        'almost done', 'nearly done'
    ],
    
    // 打字速度（毫秒）
    typingSpeed: {
        min: 50,   // 最小延迟
        max: 150   // 最大延迟
    },
    
    // 延迟配置（毫秒）
    delays: {
        beforeVerification: 3000,  // 检测到完成后等待多久验证
        beforeInjection: 2000,     // 测试失败后等待多久注入
        backgroundCheck: 30000     // 后台检查间隔
    },
    
    // 是否显示提示
    showHints: true,
    
    // 获取询问消息
    getInquiry: function(style = null) {
        style = style || this.injectionStyle;
        
        let inquiries;
        switch(style) {
            case 'natural':
                inquiries = this.naturalInquiries;
                break;
            case 'obvious':
                inquiries = this.obviousInquiries;
                break;
            case 'marked':
            default:
                inquiries = this.markedInquiries;
                break;
        }
        
        return inquiries[Math.floor(Math.random() * inquiries.length)];
    }
};