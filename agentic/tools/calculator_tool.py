# tools/calculator_tool.py

def calculate(expression):

    try:
        return str(eval(expression))

    except Exception:
        return "Calculation failed"