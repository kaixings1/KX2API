#!/bin/bash
# 系统诊断与问题排查工具
# 版本: 1.0.0

set -euo pipefail

# 加载配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${SCRIPT_DIR}/../config"
LOG_DIR="${SCRIPT_DIR}/../logs"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 检查系统资源
check_system_resources() {
    log_info "检查系统资源..."
    
    # 检查CPU使用率
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    cpu_threshold=90
    if (( $(echo "$cpu_usage > $cpu_threshold" | bc -l) )); then
        log_error "CPU使用率过高: ${cpu_usage}% (阈值: ${cpu_threshold}%)"
        return 1
    else
        log_info "CPU使用率正常: ${cpu_usage}%"
    fi
    
    # 检查内存使用率
    mem_info=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    mem_threshold=85
    if (( $(echo "$mem_info > $mem_threshold" | bc -l) )); then
        log_error "内存使用率过高: ${mem_info}% (阈值: ${mem_threshold}%)"
        return 1
    else
        log_info "内存使用率正常: ${mem_info}%"
    fi
    
    # 检查磁盘使用率
    disk_usage=$(df -h / | awk 'NR==2{print $5}' | cut -d'%' -f1)
    disk_threshold=80
    if [ "$disk_usage" -gt "$disk_threshold" ]; then
        log_error "磁盘使用率过高: ${disk_usage}% (阈值: ${disk_threshold}%)"
        return 1
    else
        log_info "磁盘使用率正常: ${disk_usage}%"
    fi
    
    return 0
}

# 检查关键服务
check_services() {
    log_info "检查关键服务状态..."
    
    local services=("ssh" "docker" "nginx" "mysql")
    local failed_services=()
    
    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            log_info "服务 $service 运行正常"
        else
            log_warn "服务 $service 未运行或未安装"
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        return 0
    else
        log_error "以下服务异常: ${failed_services[*]}"
        return 1
    fi
}

# 检查网络连接
check_network() {
    log_info "检查网络连接..."
    
    local hosts=("8.8.8.8" "1.1.1.1" "google.com")
    
    for host in "${hosts[@]}"; do
        if ping -c 1 -W 3 "$host" >/dev/null 2>&1; then
            log_info "网络连接正常: 可访问 $host"
            return 0
        fi
    done
    
    log_error "网络连接异常: 无法访问外部网络"
    return 1
}

# 检查日志文件
check_logs() {
    log_info "检查最近日志错误..."
    
    local log_files=("/var/log/syslog" "/var/log/messages" "/var/log/dmesg")
    local error_count=0
    
    for log_file in "${log_files[@]}"; do
        if [ -f "$log_file" ]; then
            local errors=$(grep -i "error\|fail\|critical" "$log_file" 2>/dev/null | tail -n 10 | wc -l)
            if [ "$errors" -gt 0 ]; then
                log_warn "$log_file 中发现 $errors 条错误/失败日志"
                error_count=$((error_count + errors))
            fi
        fi
    done
    
    if [ "$error_count" -gt 0 ]; then
        log_warn "总计发现 $error_count 条日志错误"
        return 1
    else
        log_info "日志检查完成，未发现严重错误"
        return 0
    fi
}

# 检查配置文件语法
check_configs() {
    log_info "检查配置文件语法..."
    
    local config_files=("/etc/nginx/nginx.conf" "/etc/mysql/my.cnf" "/etc/ssh/sshd_config")
    local failed_configs=()
    
    for config in "${config_files[@]}"; do
        if [ -f "$config" ]; then
            case "$config" in
                *nginx*)
                    if nginx -t -c "$config" >/dev/null 2>&1; then
                        log_info "配置文件 $config 语法正确"
                    else
                        log_error "配置文件 $config 语法错误"
                        failed_configs+=("$config")
                    fi
                    ;;
                *)
                    log_info "配置文件 $config 存在（语法检查需根据具体软件）"
                    ;;
            esac
        fi
    done
    
    if [ ${#failed_configs[@]} -eq 0 ]; then
        return 0
    else
        log_error "以下配置文件存在语法错误: ${failed_configs[*]}"
        return 1
    fi
}

# 生成报告
generate_report() {
    local report_file="${LOG_DIR}/diagnostic_$(date '+%Y%m%d_%H%M%S').log"
    
    log_info "生成诊断报告: $report_file"
    
    cat << REPORT > "$report_file"
========================================
系统诊断报告
生成时间: $(date)
主机名: $(hostname)
IP地址: $(hostname -I | awk '{print $1}')
========================================

## 系统资源
- CPU使用率: ${cpu_usage:-N/A}%
- 内存使用率: ${mem_info:-N/A}%
- 磁盘使用率: ${disk_usage:-N/A}%

## 诊断结果
$(cat << RESULTS
检查项目,状态,详情
系统资源,检查完成,
网络连接,检查完成,
关键服务,检查完成,
日志检查,检查完成,
配置文件,检查完成,
RESULTS
)

## 建议措施
1. 定期监控系统资源使用情况
2. 及时清理不必要的文件和进程
3. 保持系统和软件更新
4. 定期备份重要数据

========================================
报告生成完毕
========================================
REPORT
    
    log_info "报告已保存至: $report_file"
}

# 主函数
main() {
    log_info "========================================"
    log_info "开始系统诊断"
    log_info "========================================"
    
    local exit_code=0
    
    # 执行各项检查
    check_system_resources || exit_code=1
    check_network || exit_code=1
    check_services || exit_code=1
    check_logs || exit_code=1
    check_configs || exit_code=1
    
    # 生成报告
    generate_report
    
    log_info "========================================"
    if [ $exit_code -eq 0 ]; then
        log_info "诊断完成：系统状态正常"
    else
        log_error "诊断完成：发现问题，请查看报告"
    fi
    log_info "========================================"
    
    return $exit_code
}

# 执行主函数
main "$@"
