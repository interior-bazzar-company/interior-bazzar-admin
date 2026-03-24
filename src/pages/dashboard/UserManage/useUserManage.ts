import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

const useUserManage = () => {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearchText, setAppliedSearchText] = useState("");

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAppliedSearchText(searchInput);
  };

  return {
    searchInput,
    appliedSearchText,
    handleSearchChange,
    handleSearchSubmit,
  };
};

export default useUserManage;
