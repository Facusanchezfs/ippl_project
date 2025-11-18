import api from '../config/api';

export interface Post {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt: string;
	section: string;
	status: 'draft' | 'published';
	thumbnail?: string;
	tags: string[];
	author: string;
	authorName: string;
	featured: boolean;
	readTime: string;
	views: number;
	likes: number;
	comments: {
		id: string;
		author: string;
		content: string;
		createdAt: string;
		status: string;
	}[];
	seo: {
		metaTitle: string;
		metaDescription: string;
		keywords: string;
	};
	createdAt: string;
	updatedAt: string;
	publishedAt?: string;
}

export type CreatePostDTO = Partial<Post>;

export interface PostsResponse {
	posts: Post[];
}

export interface PostResponse {
	post: Post;
}

interface ToggleLikeResponse {
	likes: number;
}
interface IncrementViewsResponse {
	views: number;
	isViewed: boolean;
}

class PostsService {
	async getAllPosts(): Promise<PostsResponse> {
		const res = await api.get<{data: PostsResponse}>('/posts');
		return res.data.data;
	}

	async getPostBySection(section: string): Promise<PostsResponse>{
		const res = await api.get<{data: PostsResponse}>(`/posts/${section}`)
		return res.data.data;
	}

	async createPost(postData: FormData): Promise<PostResponse> {
		const res = await api.post<{data: PostResponse}>('/posts', postData);
		return res.data.data;
	}

	async updatePost(id: string, postData: FormData): Promise<Post> {
		const res = await api.put<{data: Post}>(`/posts/${id}`, postData);
		return res.data.data;
	}

	async deletePost(id: string): Promise<void> {
		await api.delete(`/posts/${id}`);
	}

	async getPostById(id: string): Promise<Post> {
		const res = await api.get(`/posts/${id}`);
		return res.data.data;
	}

	async toggleLike(id: string): Promise<ToggleLikeResponse> {
		const resp = await api.post<{data: ToggleLikeResponse}>(`/posts/${id}/toggle-like`);
		return resp.data.data;
	}

	async checkIfLiked(id: string): Promise<boolean> {
		const resp = await api.get<{data: boolean}>(`/posts/${id}/check-like`);
		return resp.data.data;
	}

	async checkIfViewed(id: string): Promise<boolean> {
		const resp = await api.get<{data: boolean}>(`/posts/${id}/check-view`);
		return resp.data.data;
	}

	async incrementViews(id: string): Promise<IncrementViewsResponse> {
		const resp = await api.post<{data: IncrementViewsResponse}>(
			`/posts/${id}/increment-view`
		);
		return resp.data.data;
	}

	async getPostBySlug(slug: string): Promise<Post> {
		const res = await api.get<{data: PostResponse}>(`/posts/slug/${slug}`);
		return res.data.data.post;
	}

	async likePost(id: string): Promise<Post> {
		const resp = await api.post<{data: Post}>(`/posts/${id}/toggle-like`);
		return resp.data.data;
	}

	async getStats() {
		const resp = await api.get('/stats');
		return resp.data;
	}
}

export default new PostsService();
