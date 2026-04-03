import PostReadScreen from '@/components/posts/PostReadScreen';

interface ReadGlobalPostPageProps {
  params: Promise<{postId: string}>;
}

export default async function ReadGlobalPostPage({params}: ReadGlobalPostPageProps) {
  const {postId} = await params;
  return <PostReadScreen scope="global" postId={postId} />;
}

