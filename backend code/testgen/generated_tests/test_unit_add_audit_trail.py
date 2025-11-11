
# ------------------- Injected by generator -------------------
import os, sys, importlib.util, types, json, pytest
from pathlib import Path

TOOL_PATH = Path(r"D:\\unit test generator\\uploads\\finance\\tools\\interface_1\\add_audit_trail.py")

# Mock tau_bench.envs.tool.Tool if not available
if "tau_bench" not in sys.modules:
    sys.modules["tau_bench"] = types.ModuleType("tau_bench")
if "tau_bench.envs" not in sys.modules:
    sys.modules["tau_bench.envs"] = types.ModuleType("tau_bench.envs")
if "tau_bench.envs.tool" not in sys.modules:
    _mock = types.ModuleType("tau_bench.envs.tool")
    class Tool: pass
    _mock.Tool = Tool
    sys.modules["tau_bench.envs.tool"] = _mock

# Ensure tool file exists
if not TOOL_PATH.exists():
    pytest.skip(f"Tool file not found at {TOOL_PATH}", allow_module_level=True)

def import_tool_module():
    spec = importlib.util.spec_from_file_location("tool_module", str(TOOL_PATH))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["tool_module"] = mod
    spec.loader.exec_module(mod)
    return mod

ToolClass = None
try:
    tool_mod = import_tool_module()

    # Strategy 1: exact CamelCase class name
    if hasattr(tool_mod, "AddAuditTrail"):
        ToolClass = getattr(tool_mod, "AddAuditTrail")

    # Strategy 2: lowercase name match
    if ToolClass is None:
        for name, obj in vars(tool_mod).items():
            if isinstance(obj, type) and name.lower() == "add_audit_trail".lower():
                ToolClass = obj
                break

    # Strategy 3: subclass of Tool
    if ToolClass is None:
        for name, obj in vars(tool_mod).items():
            if isinstance(obj, type) and hasattr(obj, "__bases__"):
                for base in obj.__bases__:
                    if base.__name__ == "Tool":
                        ToolClass = obj
                        break
                if ToolClass:
                    break

    # Strategy 4: first defined class in module (fallback)
    if ToolClass is None:
        for name, obj in vars(tool_mod).items():
            if isinstance(obj, type) and obj.__module__ == "tool_module" and not name.startswith("_"):
                ToolClass = obj
                break

    if ToolClass is None:
        pytest.skip("Tool class could not be located.", allow_module_level=True)

except Exception as err:
    err_msg = str(err)
    pytest.skip(f"Tool import failed: {err_msg}", allow_module_level=True)

@pytest.fixture(scope="module")
def tool_instance():
    if ToolClass is None:
        pytest.skip("Tool class not available")
    try:
        instance = ToolClass()
        assert hasattr(instance, "invoke"), "Tool instance missing invoke()"
        return instance
    except Exception as inst_err:
        pytest.skip(f"Could not instantiate tool: {inst_err}")
# -------------------------------------------------------------


# Placeholder usage for runner substitution: {USER_INPUT:reference_id}, {USER_EXPECTED:audit_trail_id}
import json
import pytest


def test_create_success_with_existing_user_table_and_id_start(tool_instance):
    data = {
        'users': {'123': {'name': 'Alice'}},
        'audit_trails': {}
    }
    res = tool_instance.invoke(
        data,
        reference_id='123',
        reference_type='user',
        action='create',
        field_name=None,
        old_value=None,
        new_value='initial state'
    )
    obj = json.loads(res)
    # Regression: stable keys and timestamp
    assert obj['audit_trail_id'] == '1'
    assert obj['created_at'] == '2025-10-01T00:00:00'
    # Echoed fields
    assert obj['reference_id'] == '123'
    assert obj['reference_type'] == 'user'
    assert obj['action'] == 'create'
    assert obj['field_name'] is None
    assert obj['old_value'] is None
    assert obj['new_value'] == 'initial state'


def test_delete_success_with_old_value_and_null_new_value(tool_instance):
    data = {
        'users': {'abc': {'name': 'Bob'}},
        'audit_trails': {'1': {'dummy': True}}
    }
    res = tool_instance.invoke(
        data,
        reference_id='abc',
        reference_type='user',
        action='delete',
        field_name=None,
        old_value='previous',
        new_value=None
    )
    obj = json.loads(res)
    assert obj['reference_id'] == 'abc'
    assert obj['reference_type'] == 'user'
    assert obj['action'] == 'delete'
    assert obj['field_name'] is None
    assert obj['old_value'] == 'previous'
    assert obj['new_value'] is None
    assert obj['created_at'] == '2025-10-01T00:00:00'


def test_update_success_with_field_change_and_id_increment(tool_instance):
    data = {
        'funds': {'F1': {'name': 'Fund 1'}},
        'audit_trails': {
            '2': {'dummy': True},
            '10': {'dummy': True}
        }
    }
    res = tool_instance.invoke(
        data,
        reference_id='F1',
        reference_type='fund',
        action='update',
        field_name='status',
        old_value='draft',
        new_value='approved'
    )
    obj = json.loads(res)
    # ID should be max(2,10) + 1 = 11 and be string
    assert obj['audit_trail_id'] == '11'
    assert isinstance(obj['audit_trail_id'], str)
    assert obj['reference_type'] == 'fund'
    assert obj['action'] == 'update'
    assert obj['field_name'] == 'status'
    assert obj['old_value'] == 'draft'
    assert obj['new_value'] == 'approved'


# Negative tests: enums and business rules

def test_invalid_action_raises_value_error(tool_instance):
    data = {'users': {'1': {}}}
    with pytest.raises(ValueError) as ei:
        tool_instance.invoke(
            data,
            reference_id='1',
            reference_type='user',
            action='archive',  # invalid
            field_name=None,
            old_value=None,
            new_value=None
        )
    assert 'Invalid action' in str(ei.value)


def test_invalid_reference_type_raises_value_error(tool_instance):
    data = {}
    with pytest.raises(ValueError) as ei:
        tool_instance.invoke(
            data,
            reference_id='1',
            reference_type='unknown',  # invalid
            action='create',
            field_name=None,
            old_value=None,
            new_value='x'
        )
    assert 'Invalid reference_type' in str(ei.value)


def test_field_name_must_be_null_for_create(tool_instance):
    data = {}
    with pytest.raises(ValueError) as ei:
        tool_instance.invoke(
            data,
            reference_id='1',
            reference_type='user',
            action='create',
            field_name='should_be_null',
            old_value=None,
            new_value='x'
        )
    assert 'field_name should be null for create actions' in str(ei.value)


def test_field_name_must_be_null_for_delete(tool_instance):
    data = {}
    with pytest.raises(ValueError) as ei:
        tool_instance.invoke(
            data,
            reference_id='1',
            reference_type='user',
            action='delete',
            field_name='should_be_null',
            old_value='y',
            new_value=None
        )
    assert 'field_name should be null for delete actions' in str(ei.value)


def test_old_value_must_be_null_for_create(tool_instance):
    data = {}
    with pytest.raises(ValueError) as ei:
        tool_instance.invoke(
            data,
            reference_id='1',
            reference_type='user',
            action='create',
            field_name=None,
            old_value='not allowed',
            new_value='x'
        )
    assert 'old_value should be null for create actions' in str(ei.value)


def test_new_value_must_be_null_for_delete(tool_instance):
    data = {}
    with pytest.raises(ValueError) as ei:
        tool_instance.invoke(
            data,
            reference_id='1',
            reference_type='user',
            action='delete',
            field_name=None,
            old_value='previous',
            new_value='not allowed'
        )
    assert 'new_value should be null for delete actions' in str(ei.value)


def test_reference_id_not_found_raises_error(tool_instance):
    data = {
        'users': {'123': {'name': 'Alice'}}
    }
    with pytest.raises(ValueError) as ei:
        tool_instance.invoke(
            data,
            reference_id='999',
            reference_type='user',
            action='update',
            field_name='name',
            old_value='A',
            new_value='B'
        )
    assert 'User 999 not found' in str(ei.value)


# Edge cases

def test_create_with_empty_data_starts_id_at_1_and_timestamp_constant(tool_instance):
    data = {}
    res = tool_instance.invoke(
        data,
        reference_id='X',
        reference_type='user',
        action='create',
        field_name=None,
        old_value=None,
        new_value='init'
    )
    obj = json.loads(res)
    assert obj['audit_trail_id'] == '1'
    assert obj['created_at'] == '2025-10-01T00:00:00'


def test_update_allows_none_field_name(tool_instance):
    data = {'users': {'5': {}}, 'audit_trails': {}}
    res = tool_instance.invoke(
        data,
        reference_id='5',
        reference_type='user',
        action='update',
        field_name=None,
        old_value='old',
        new_value='new'
    )
    obj = json.loads(res)
    assert obj['field_name'] is None
    assert obj['old_value'] == 'old'
    assert obj['new_value'] == 'new'


def test_reference_id_int_matches_string_ids(tool_instance):
    data = {
        'users': {'5': {'name': 'NumUser'}},
        'audit_trails': {}
    }
    res = tool_instance.invoke(
        data,
        reference_id=5,  # int provided, should match '5' in data
        reference_type='user',
        action='update',
        field_name='name',
        old_value='NumUser',
        new_value='NumUser2'
    )
    obj = json.loads(res)
    assert obj['reference_id'] == 5  # echo original type back
    assert obj['audit_trail_id'].isdigit()


# Schema adherence / get_info regression

def test_get_info_schema_and_required_fields(tool_instance):
    info = tool_instance.get_info()
    assert info['function']['name'] == 'add_audit_trail'
    params = info['function']['parameters']
    assert params['type'] == 'object'
    required = set(params['required'])
    assert {'reference_id', 'reference_type', 'action'}.issubset(required)
    props = params['properties']
    for key in ['reference_id', 'reference_type', 'action', 'field_name', 'old_value', 'new_value']:
        assert key in props
