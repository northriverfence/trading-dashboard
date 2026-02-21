// cpp/hnswlib_wrapper.cpp
// C++ wrapper for hnswlib to expose C-compatible FFI bindings

#include <hnswlib/hnswlib.h>
#include <cstring>
#include <memory>
#include <mutex>

// Thread-local error storage
thread_local std::string last_error;

// Helper to set error
extern "C" void set_error(const char* msg) {
    last_error = msg;
}

extern "C" const char* get_last_error() {
    if (last_error.empty()) return nullptr;
    return last_error.c_str();
}

// Clear error
extern "C" void clear_error() {
    last_error.clear();
}

// Create space based on type
hnswlib::SpaceInterface<float>* create_space(const char* space_type, size_t dim) {
    if (strcmp(space_type, "l2") == 0) {
        return new hnswlib::L2Space(dim);
    } else if (strcmp(space_type, "ip") == 0) {
        return new hnswlib::InnerProductSpace(dim);
    } else if (strcmp(space_type, "cosine") == 0) {
        return new hnswlib::InnerProductSpace(dim);
    }
    return nullptr;
}

// Opaque handle for index
struct IndexHandle {
    std::unique_ptr<hnswlib::SpaceInterface<float>> space;
    std::unique_ptr<hnswlib::HierarchicalNSW<float>> index;
    std::string space_type;
    size_t dim;
};

// Create new index
extern "C" void* create_index(
    const char* space_type,
    size_t dim,
    size_t max_elements,
    size_t m,
    size_t ef_construction,
    size_t seed
) {
    clear_error();

    try {
        auto space = create_space(space_type, dim);
        if (!space) {
            set_error("Invalid space type");
            return nullptr;
        }

        auto index = std::make_unique<hnswlib::HierarchicalNSW<float>>(
            space, max_elements, m, ef_construction, seed
        );

        auto handle = new IndexHandle{
            std::move(std::unique_ptr<hnswlib::SpaceInterface<float>>(space)),
            std::move(index),
            std::string(space_type),
            dim
        };

        return handle;
    } catch (const std::exception& e) {
        set_error(e.what());
        return nullptr;
    }
}

// Free index
extern "C" void free_index(void* handle) {
    if (handle) {
        delete static_cast<IndexHandle*>(handle);
    }
}

// Add vector to index
extern "C" void add_vector(void* handle, const float* vector, size_t label, size_t dim) {
    clear_error();

    if (!handle) {
        set_error("Invalid handle");
        return;
    }

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        h->index->addPoint(vector, label, false);
    } catch (const std::exception& e) {
        set_error(e.what());
    }
}

// Search K nearest neighbors
extern "C" void search_knn(
    void* handle,
    const float* query,
    size_t k,
    size_t dim,
    uint32_t* indices,
    float* distances
) {
    clear_error();

    if (!handle) {
        set_error("Invalid handle");
        return;
    }

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        auto result = h->index->searchKnn(query, k);

        size_t i = 0;
        for (auto& pair : result) {
            if (i >= k) break;
            distances[i] = pair.first;
            indices[i] = static_cast<uint32_t>(pair.second);
            i++;
        }
    } catch (const std::exception& e) {
        set_error(e.what());
    }
}

// Mark element as deleted
extern "C" void mark_delete(void* handle, size_t label) {
    clear_error();

    if (!handle) {
        set_error("Invalid handle");
        return;
    }

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        h->index->markDelete(label);
    } catch (const std::exception& e) {
        set_error(e.what());
    }
}

// Resize index
extern "C" void resize_index(void* handle, size_t new_max_elements) {
    clear_error();

    if (!handle) {
        set_error("Invalid handle");
        return;
    }

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        h->index->resizeIndex(new_max_elements);
    } catch (const std::exception& e) {
        set_error(e.what());
    }
}

// Get current element count
extern "C" size_t get_current_count(void* handle) {
    if (!handle) return 0;

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        return h->index->cur_element_count;
    } catch (...) {
        return 0;
    }
}

// Save index to file
extern "C" void save_index(void* handle, const char* filename) {
    clear_error();

    if (!handle) {
        set_error("Invalid handle");
        return;
    }

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        h->index->saveIndex(filename);
    } catch (const std::exception& e) {
        set_error(e.what());
    }
}

// Load index from file
extern "C" void load_index(void* handle, const char* filename) {
    clear_error();

    if (!handle) {
        set_error("Invalid handle");
        return;
    }

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        h->index->loadIndex(filename, h->space.get(), h->dim);
    } catch (const std::exception& e) {
        set_error(e.what());
    }
}

// Set ef parameter
extern "C" void set_ef(void* handle, size_t ef) {
    clear_error();

    if (!handle) {
        set_error("Invalid handle");
        return;
    }

    try {
        auto* h = static_cast<IndexHandle*>(handle);
        h->index->setEf(ef);
    } catch (const std::exception& e) {
        set_error(e.what());
    }
}
