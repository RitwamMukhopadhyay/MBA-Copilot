import platform

def get_system_info():
    return {
        "os": platform.system(),
        "machine": platform.machine(),
        "processor": platform.processor()
    }
