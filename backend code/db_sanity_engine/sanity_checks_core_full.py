import pandas as pd
from typing import List, Dict, Any


def normalize_type(t):
    s = str(t).strip().upper()
    if s == "61":
        s = "1:1"
    if s not in {"1:1", "1:N", "M:N"}:
        raise ValueError(f"Unsupported relationship type: {t!r}")
    return s


def check_foreign_keys(relationships: List[Dict[str, Any]], dfs: Dict[str, pd.DataFrame], report: Dict[str, Any]):
    if "relationships" not in report:
        report["relationships"] = []

    for rel in relationships:
        p_table = rel.get("parent_table")
        p_col = rel.get("parent_column")
        c_table = rel.get("child_table")
        c_col = rel.get("child_column")
        rtype_raw = rel.get("type")
        try:
            rtype = normalize_type(rtype_raw)
        except Exception:
            rtype = rtype_raw

        mandatory = rel.get("mandatory", False)
        min_children = rel.get("min_children")
        max_children = rel.get("max_children")

        check_name = f"{p_table}.{p_col} → {c_table}.{c_col}"

        # Ensure report has relationships container
        if "relationships" not in report:
            report["relationships"] = []

        # Skip if missing tables
        if p_table not in dfs or c_table not in dfs:
            report["relationships"].append({
                "relationship": check_name,
                "check": "Tables present",
                "result": False,
                "details": {"reason": "Missing table(s)"}
            })
            continue

        parent_df = dfs[p_table]
        child_df = dfs[c_table]

        # Column existence checks
        for tname, df, col, role in ((p_table, parent_df, p_col, "parent"), (c_table, child_df, c_col, "child")):
            exists = col in df.columns
            report["relationships"].append({
                "relationship": check_name,
                "check": f"{role.capitalize()} column exists",
                "result": exists,
                "details": {"table": tname, "column": col}
            })
        if p_col not in parent_df.columns or c_col not in child_df.columns:
            # cannot proceed without both columns
            continue

        # Normalize types for membership checks
        p_series = parent_df[p_col]
        c_series = child_df[c_col]

        try:
            c_cast = c_series.astype(p_series.dtype, copy=False)
        except Exception:
            c_cast = c_series

        null_count = int(c_cast.isna().sum())
        non_null = c_cast.dropna()

        report["relationships"].append({
            "relationship": check_name,
            "check": "Child column nulls",
            "result": True,
            "details": {"column": c_col, "null_count": null_count, "non_null_count": int(non_null.shape[0])}
        })

        # 1) Referential integrity
        missing_mask = ~non_null.isin(p_series)
        missing_ids = non_null[missing_mask].unique().tolist()
        total_missing = len(missing_ids)
        exists_ok = total_missing == 0
        report["relationships"].append({
            "relationship": check_name,
            "check": "All children have parents",
            "result": exists_ok,
            "details": {"column": c_col, "missing_ids_sample": missing_ids[:5], "count": total_missing}
        })

        # 2) Parent uniqueness
        dup_parents = p_series[p_series.duplicated(keep=False)].unique().tolist()
        total_dups = len(dup_parents)
        parent_unique = total_dups == 0
        report["relationships"].append({
            "relationship": check_name,
            "check": "Parent column unique",
            "result": parent_unique,
            "details": {"column": p_col, "duplicate_parent_ids_sample": dup_parents[:5], "count": total_dups}
        })

        # Cardinality-specific checks
        if rtype == "1:1":
            dup_children = non_null[non_null.duplicated(keep=False)].unique().tolist()
            total_child_dups = len(dup_children)
            child_unique = total_child_dups == 0
            report["relationships"].append({
                "relationship": check_name,
                "check": "Child column unique (1:1)",
                "result": child_unique,
                "details": {"column": c_col, "duplicate_child_ids_sample": dup_children[:5], "count": total_child_dups}
            })

            if mandatory:
                used_parents = set(non_null.unique().tolist())
                all_parents = set(p_series.unique().tolist())
                missing_parents = list(all_parents - used_parents)
                vc = non_null.value_counts(dropna=False)
                not_exact_one = vc[vc != 1].index.tolist()
                ok = (len(missing_parents) == 0) and (len(not_exact_one) == 0)
                report["relationships"].append({
                    "relationship": check_name,
                    "check": "Mandatory 1:1 coverage (each parent exactly once)",
                    "result": ok,
                    "details": {
                        "missing_parent_ids_sample": missing_parents[:5],
                        "over_or_under_referenced_ids_sample": not_exact_one[:5],
                        "missing_count": len(missing_parents),
                        "over_or_under_count": len(not_exact_one)
                    }
                })

        elif rtype == "1:N":
            vc = non_null.value_counts()
            avg_count = round(float(vc.mean()), 2) if not vc.empty else 0.0
            min_count = int(vc.min()) if not vc.empty else 0
            max_count = int(vc.max()) if not vc.empty else 0
            top5 = vc.sort_values(ascending=False).head(5).to_dict()

            report["relationships"].append({
                "relationship": check_name,
                "check": "Children per parent (distribution)",
                "result": True,
                "details": {"avg": avg_count, "min": min_count, "max": max_count, "top5_parents_by_children": top5}
            })

            if min_children is not None:
                below = vc[vc < min_children]
                ok = below.empty
                report["relationships"].append({
                    "relationship": check_name,
                    "check": f"Min children per parent ≥ {min_children}",
                    "result": ok,
                    "details": {"violating_parent_ids_sample": below.index.tolist()[:5], "violations": int((vc < min_children).sum())}
                })
            if max_children is not None:
                above = vc[vc > max_children]
                ok = above.empty
                report["relationships"].append({
                    "relationship": check_name,
                    "check": f"Max children per parent ≤ {max_children}",
                    "result": ok,
                    "details": {"violating_parent_ids_sample": above.index.tolist()[:5], "violations": int((vc > max_children).sum())}
                })

            if mandatory:
                used_parents = set(non_null.unique().tolist())
                all_parents = set(parent_df[p_col].unique().tolist())
                missing_parents = list(all_parents - used_parents)
                ok = (len(missing_parents) == 0)
                report["relationships"].append({
                    "relationship": check_name,
                    "check": "Mandatory 1:N coverage (each parent at least once)",
                    "result": ok,
                    "details": {"missing_parent_ids_sample": missing_parents[:5], "missing_count": len(missing_parents)}
                })

        elif rtype == "M:N":
            lp = rel.get("link_parent_column")
            lc = rel.get("link_child_column")
            ok_meta = bool(lp and lc and lp in child_df.columns and lc in child_df.columns)
            report["relationships"].append({
                "relationship": f"{c_table} ({lp},{lc})",
                "check": "Link columns present (M:N)",
                "result": ok_meta,
                "details": {"table": c_table, "parent_link_col": lp, "child_link_col": lc}
            })
            if ok_meta:
                pair_dups = (
                    child_df[[lp, lc]]
                    .assign(_pair=lambda d: d[lp].astype(str) + "§" + d[lc].astype(str))
                )
                dup_pairs = pair_dups["_pair"][pair_dups["_pair"].duplicated(keep=False)].unique().tolist()
                ok_pairs = len(dup_pairs) == 0
                report["relationships"].append({
                    "relationship": f"{c_table} ({lp},{lc})",
                    "check": "Composite uniqueness (parent, child)",
                    "result": ok_pairs,
                    "details": {"duplicate_pairs_sample": dup_pairs[:5], "count": len(dup_pairs)}
                })

                parent_exists = child_df[lp].dropna().isin(parent_df[p_col]).all()
                report["relationships"].append({
                    "relationship": f"{p_table}.{p_col} → {c_table}.{lp}",
                    "check": "All link parent IDs have parents",
                    "result": parent_exists,
                    "details": {}
                })

        else:
            report["relationships"].append({
                "relationship": check_name,
                "check": "Unknown relationship type",
                "result": False,
                "details": {"type": rtype}
            })


# Generic (polymorphic) FK checker

def check_generic_foreign_keys(gfk_configs: List[Dict[str, Any]], dfs: Dict[str, pd.DataFrame], report: Dict[str, Any]):
    """Validates polymorphic foreign keys based on gfk configuration.

    gfk_configs: list of dicts, each specifying:
      child_table, type_column, id_column, mapping: {type_value: {parent_table, parent_column, ...}}

    The function appends results into report['relationships'] with kind='generic'.
    """
    if "relationships" not in report:
        report["relationships"] = []

    # helper
    def add_result(relationship, check, result, details=None, kind="generic"):
        report["relationships"].append({
            "relationship": relationship,
            "check": check,
            "result": result,
            "details": details or {},
            "kind": kind
        })

    table_columns = {t: set(df.columns) for t, df in dfs.items()}

    for cfg in (gfk_configs or []):
        child_table = cfg.get("child_table")
        type_col = cfg.get("type_column")
        id_col = cfg.get("id_column")
        mapping = cfg.get("mapping", {})

        rel_label = f"{child_table}.{id_col} (type via {type_col})"

        if not child_table or child_table not in dfs:
            add_result(rel_label, "Child table present", False, {"child_table": child_table})
            continue

        child_df = dfs[child_table]

        for col_name, label in [(type_col, "type column"), (id_col, "id column")]:
            if not col_name or col_name not in child_df.columns:
                add_result(rel_label, f"Child {label} present", False, {"column": col_name})
                continue

        type_values = child_df[type_col].dropna().astype(str).unique().tolist()
        mapped_types = set(mapping.keys())
        data_types = set(type_values)

        unmapped_types = sorted(list(data_types - mapped_types))
        stale_mapping = sorted(list(mapped_types - data_types))

        add_result(rel_label, "All type values are mapped", len(unmapped_types) == 0,
                   {"unmapped_types": unmapped_types[:10], "count": len(unmapped_types)})

        if stale_mapping:
            add_result(rel_label, "Stale mapping entries (info)", True,
                       {"stale_types": stale_mapping[:10], "count": len(stale_mapping)})

        for tval in sorted(data_types):
            if tval not in mapping:
                continue

            m = mapping[tval] or {}
            p_table = m.get("parent_table")
            p_col = m.get("parent_column")
            relationship_name = f"{child_table}.{id_col} (type='{tval}') → {p_table}.{p_col}"

            if p_table not in dfs or not p_col or p_col not in dfs.get(p_table, pd.DataFrame()).columns:
                add_result(relationship_name, "Parent table/column present", False,
                           {"parent_table": p_table, "parent_column": p_col})
                continue

            parent_df = dfs[p_table]
            parent_ids = set(parent_df[p_col].dropna().tolist())

            type_mask = child_df[type_col] == tval
            ids = child_df.loc[type_mask, id_col].dropna()

            missing_mask = ~ids.isin(parent_ids)
            missing_ids = ids[missing_mask].unique().tolist()
            total_missing = len(missing_ids)

            add_result(relationship_name, "All children have parents (polymorphic)", total_missing == 0,
                       {"type": tval, "child_column": id_col, "missing_ids": missing_ids[:5], "count": total_missing})

            vc = ids.value_counts()
            avg_children = round(float(vc.mean()), 2) if not vc.empty else 0.0
            max_children = int(vc.max()) if not vc.empty else 0
            add_result(relationship_name, "Average children per parent (info)", avg_children,
                       {"type": tval, "max_children_for_single_parent": max_children})

            allowed_actions = set((m.get("allowed_actions") or []))
            if allowed_actions and "action" in child_df.columns:
                actions = child_df.loc[type_mask, "action"].dropna().astype(str)
                invalid = actions[~actions.isin(allowed_actions)]
                invalid_count = int(invalid.shape[0])
                sample = invalid.head(5).tolist()
                add_result(relationship_name, "Action allowed for type", invalid_count == 0,
                           {"type": tval, "invalid_actions": sample, "count": invalid_count, "allowed_actions": sorted(list(allowed_actions))})

            if "field_name" in child_df.columns:
                field_series = child_df.loc[type_mask, "field_name"].dropna().astype(str)
                if not field_series.empty:
                    valid_cols = table_columns.get(p_table, set())
                    invalid_fields = field_series[~field_series.isin(valid_cols)]
                    inv_count = int(invalid_fields.shape[0])
                    sample_inv = invalid_fields.head(5).tolist()
                    add_result(relationship_name, "field_name valid for parent type", inv_count == 0,
                               {"type": tval, "invalid_field_names": sample_inv, "count": inv_count, "parent_table_columns_sample": list(sorted(list(valid_cols)))[:10]})

            child_has_ts = "created_at" in child_df.columns
            parent_has_ts = "created_at" in parent_df.columns
            if child_has_ts and parent_has_ts:
                c_tmp = child_df.loc[type_mask, [id_col, "created_at"]].rename(columns={id_col: "_pid", "created_at": "_child_ts"})
                p_tmp = parent_df[[p_col, "created_at"]].rename(columns={p_col: "_pid", "created_at": "_parent_ts"})
                merged = pd.merge(c_tmp, p_tmp, how="left", on="_pid")
                cts = pd.to_datetime(merged["_child_ts"], errors="coerce", utc=True)
                pts = pd.to_datetime(merged["_parent_ts"], errors="coerce", utc=True)
                bad_order = (cts < pts) & pts.notna() & cts.notna()
                viol_count = int(bad_order.sum())
                add_result(relationship_name, "created_at sequence valid (child ≥ parent)", viol_count == 0,
                           {"type": tval, "violations": viol_count})

        # 2) User link validity
        if "user_id" in child_df.columns:
            if "users" in dfs and "user_id" in dfs["users"].columns:
                user_ids = set(dfs["users"]["user_id"].dropna().tolist())
                non_null_u = child_df["user_id"].dropna()
                missing_users = non_null_u[~non_null_u.isin(user_ids)].unique().tolist()
                miss_count = len(missing_users)
                add_result(f"{child_table}.user_id → users.user_id", "All children have valid users", miss_count == 0,
                           {"missing_user_ids": missing_users[:5], "count": miss_count})
            else:
                add_result(f"{child_table}.user_id → users.user_id", "Users table present", False,
                           {"reason": "users table or user_id column not found"})

